/**
 * Cardápio digital → Google Sheets
 * --------------------------------
 * Recebe o cardápio e os pedidos e grava em abas separadas:
 *
 *   Pedidos   → uma linha por pedido (fixo, cabeçalho nunca muda)
 *   Itens     → uma linha por item pedido (formato longo, dá pra somar)
 *   Cardápio  → uma linha por item do cardápio (estado atual), com
                a coluna "Link da imagem" já clicável
 *   Registro  → histórico de cada chamada, para depurar
 *
 * Por que "Itens" separada em vez de uma coluna por produto?
 * O cabeçalho da aba Pedidos mudaria a cada pedido que trouxesse
 * um item diferente, e reconstruir a aba apagaria o histórico. No
 * formato longo o cabeçalho é sempre o mesmo e dá para fazer
 * =SOMASE(B:B;"X-Burguer";C:C) e saber quanto saiu de cada item.
 *
 * Como publicar
 * -------------
 * 1. Abra a planilha no Google Sheets.
 * 2. Extensões → Apps Script. Apague o conteúdo de "Code.gs".
 * 3. Cole este arquivo inteiro e salve (Ctrl+S).
 * 4. Clique no ícone ▷ (Executar) na primeira vez e autorize o acesso.
 *    Escolha uma função, `doPost`, e aceite a tela de permissão.
 *    (O Google só libera a implantação para "Anyone" depois do 1º uso.)
 * 5. Implantar → Nova implantação → tipo "Web app".
 *    ▸ Execute como: eu mesmo
 *    ▸ Quem pode acessar: QUALQUER PESSOA
 * 6. Copie a URL /exec e cole no painel, em Configurações →
 *    Planilha Google Sheets.
 *
 * TOKEN é opcional, e protege SÓ A ESCRITA (o POST). A leitura do
 * cardápio é de graça e sempre foi: o cardápio é público, quem abre
 * o site já vê os itens e o WhatsApp na tela. Preencha o TOKEN aqui e
 * no painel para impedir que qualquer pessoa com a URL grave pedidos
 * falsos na sua planilha. Quem souber o token ainda pode ler e apagar
 * a planilha — é proteção contra alguém que achou a URL, não contra
 * quem tem acesso ao arquivo.
 */

var TOKEN = 'GUIGA9805_LINDO';           // deixe vazio para não exigir token

/* A aba do cardápio é a única que este arquivo precisa conocer pelo
   nome: as demais chegam nomeadas no corpo do POST (spec.nome), e a
   de histórico é a constante 'Registro' usada em registrar(). Sem esta
   linha, o doGet cairia em ReferenceError ao tentar ler os links. */
var ABA_CARDAPIO = 'Cardápio';

/* Aba de configuração da loja: chave e valor, uma linha por campo.
   Ela existe porque o cardápio da página do cliente é montado a
   partir da planilha, e o resto da loja (WhatsApp, taxa de entrega,
   cor da marca) também precisa de um lugar só. */
var ABA_CONFIG = 'Config';

/* Campos que a aba Config transporta.
   planilhaUrl e planilhaToken ficam de fora de propósito: é a URL
   que diz ONDE ler, então pedir isso à planilha seria circular — e
   pior, deixaria quem edita a aba apontar a leitura do cardápio
   inteiro para outro lugar. O destino da leitura fica sempre no
   navegador de quem publicou. */
var CAMPOS_CONFIG = [
  'nome', 'descricao', 'whatsapp', 'mensagemAbertura', 'corPrimaria',
  'simboloMoeda', 'taxaEntrega', 'pedidoMinimo', 'aberto',
  'mensagemFechado', 'pedirNome', 'pedirEntrega',
  'formasPagamento', 'tempoEntrega', 'tempoRetirada', 'enderecoLoja', 'instagram',
  'chavePix', 'pixCidade'
];

/* A coluna A e escrita a mao e o dono digita o rotulo que le na tela
   ("Chave PIX", "Cidade do recebedor"), nao o nome interno. Antes isso
   era um silencio: a linha ficava na planilha, o script nao a
   reconhecia e o PIX simplesmente nao existia. Agora a comparacao
   ignora maiuscula, acento, espaco e pontuacao, e APELIDO_CONFIG amarra
   o rotulo ao campo certo. O nome interno continua valendo: e a forma
   como o painel escreve. */
var APELIDO_CONFIG = {
  chave: 'chavePix',
  chavepix: 'chavePix',
  chavealeatoria: 'chavePix',
  pix: 'chavePix',
  pixchave: 'chavePix',
  cidade: 'pixCidade',
  pixcidade: 'pixCidade',
  estadorecebedor: 'pixCidade',
  cidaderecebedor: 'pixCidade',
  cidadedorecebedor: 'pixCidade'
};

/* Rotulos da aba Config que o script nao reconheceu. Vao na resposta da
   leitura para o painel avisar, em vez de a linha sumir sem ninguem
   perceber. So os NOMES: os valores das linhas nao reconhecidas nao
   sao devolvidos. */
var CHAVES_IGNORADAS = [];

/* Linhas que o painel grava de proposito e que NAO transportam nada
   para o cardapio (sao o rastro de qual URL e qual token publicaram, e
   a data da publicacao). Elas entram na conta de "nao reconhecida" sem
   gerar aviso: sao esperadas, nao erro de digitacao. Sem esta lista o
   painel acusaria a propria Config a cada "Buscar da planilha". */
var LINHAS_AUDITORIA = ['url-do-web-app', 'token-do-script', 'publicado_em'];

/* "Chave PIX" e "chave_pix" precisam cair no mesmo nome. */
function semAcentoConfig(txt) {
  return String(txt == null ? '' : txt).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function chaveConfigNormalizada(chave) {
  return semAcentoConfig(chave).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* Devolve o campo de Config que a linha escrita representa, ou '' se
   nao for nenhum. */
function campoConfigDe(chave) {
  var escrita = String(chave == null ? '' : chave).trim();
  if (!escrita) return '';
  if (CAMPOS_CONFIG.indexOf(escrita) >= 0) return escrita;

  var normal = chaveConfigNormalizada(escrita);
  if (!normal) return '';

  for (var i = 0; i < CAMPOS_CONFIG.length; i++) {
    if (chaveConfigNormalizada(CAMPOS_CONFIG[i]) === normal) return CAMPOS_CONFIG[i];
  }

  return APELIDO_CONFIG[normal] || '';
}

/* Chave PIX de telefone e so digito: 55 + DDD + numero, sem "+", sem
   espaco e sem hifen. O dono copia do app do banco, que mostra
   "+55 98 98881-5481", e o QR saia invalido — parecia funcionar e
   ninguem recebia. E-mail e chave aleatoria nunca entram nesta regra
   porque tem letra. */
function chavePixLimpa(valor) {
  var s = String(valor == null ? '' : valor).trim();
  if (!s) return '';
  if (!/^\+?[0-9 ()./-]+$/.test(s)) return s;

  var digitos = s.replace(/[^0-9]/g, '');
  var n = digitos.length;

  /* Com "+" (telefone com DDI) e nas Contagens 12, 13 e 14 (telefone
     com DDI e CNPJ) nao ha duvida: pode limpar. */
  if (s.indexOf('+') >= 0) return digitos;
  if (n === 12 || n === 13 || n === 14) return digitos;

  /* Onze digitos e ambiguo: pode ser CPF com pontuacao ou telefone sem
     o +55. Limpar sem conferir trocaria uma chave por outra em
     silencio — o pior jeito de errar. So limpa quando o digito
     verificador diz que e CPF mesmo; no resto deixa o texto do dono
     como esta. */
  if (n === 11 && cpfValido(digitos)) return digitos;

  return s;
}

/* CPF tem digito verificador. Serve para separar "CPF com ponto e
   hifen" de "telefone sem o +55", que tambem tem onze digitos. */
function cpfValido(digitos) {
  var d = String(digitos || '');
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;

  var soma = 0;
  for (var i = 0; i < 9; i++) soma += Number(d.charAt(i)) * (10 - i);
  var resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(d.charAt(9))) return false;

  soma = 0;
  for (var j = 0; j < 10; j++) soma += Number(d.charAt(j)) * (11 - j);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;

  return resto === Number(d.charAt(10));
}

/* Aba de taxas por bairro: uma linha por bairro (Bairro, Taxa, Tempo,
   Ativo). Quando existe, o cliente escolhe o bairro no checkout e a
   taxa dele vence a taxa unica da aba Config. */
var ABA_BAIRROS = 'Bairros';

/* Aba de opcoes de item: uma linha por opcao (Item, Grupo, Tipo,
   Opcao, Preco, Obrigatorio). As opcoes de um grupo sao juntadas pelo
   nome do item e anexadas a ele na leitura, para o cliente escolher o
   tamanho, os adicionais ou os sabores no carrinho. */
var ABA_OPCOES = 'Opcoes';

/* Abas de pedido. A aba Itens e o formato longo (uma linha por item
   pedido), que e o que permite somar por item. */
var ABA_PEDIDOS = 'Pedidos';
var ABA_ITENS = 'Itens';

/* Aba de relatorio de vendas. E GERADA pelo script a cada pedido:
   o conteudo e sempre recalculado, entao nao ha o risco de ficar
   defasado em relacao as abas Pedidos/Itens. */
var ABA_RELATORIO = 'Relatorio';

/* Frase que o painel tem que devolver para a limpeza ser aceita.
   Apagar pedido e nao tem volta, entao o botao so fica disponivel
   com o token E com esta frase exata. */
var FRASE_LIMPAR = 'apagar tudo';

/* ------------------------------------------------------------------
   Recebe o POST do navegador
   ------------------------------------------------------------------ */
function doPost(e) {
  var dados;

  try {
    dados = JSON.parse(e.postData.contents || '{}');
  } catch (erro) {
    return responder({ ok: false, erro: 'JSON inválido: ' + erro.message });
  }

  if (TOKEN && dados.token !== TOKEN) {
    registrar('bloqueado', 'token inválido, pedido descartado');
    return responder({ ok: false, erro: 'Token inválido.' });
  }

  /* Ação alterarStatus: atualiza o status de um pedido */
  if (dados.acao === 'alterarStatus') {
    var abas = dados.abas;
    if (!Array.isArray(abas) || !abas.length) {
      return responder({ ok: false, erro: 'Dados de alteração de status não encontrados.' });
    }
    var spec = abas[0];
    var resultado = alterarStatusPedido(spec.pedido, spec.status);
    return responder(resultado);
  }

  /* Ação limpar: apaga pedidos e itens. Precisa da frase de
     confirmação, senão qualquer POST valido apagaria o historico. */
  if (dados.acao === 'limpar') {
    return responder(limparPedidos(dados.confirmacao));
  }

  var abas = dados.abas;

  if (!Array.isArray(abas) || !abas.length) {
    return responder({ ok: false, erro: 'O pedido não trouxe nenhuma aba.' });
  }

  var resumo = [];

  try {
    for (var i = 0; i < abas.length; i++) {
      resumo.push(escreverAba(abas[i], dados.acao, dados.origem));
    }
  } catch (erro) {
    registrar('erro', dados.acao + ': ' + erro.message);
    return responder({ ok: false, erro: erro.message });
  }

  /* O relatorio e derivado das abas gravadas agora. Se ele falhar,
     o pedido ja esta salvo: nao vale devolver erro para o cliente
     por causa de uma aba de leitura. */
  if (dados.acao === 'pedido') {
    try {
      gerarRelatorio();
    } catch (erro) {
      registrar('erro', 'relatorio: ' + erro.message);
    }
  }

  return responder({ ok: true, abas: resumo });
}

/**
 * GET devolve o cardápio publicado (abas Cardápio e Config) em JSON.
 *
 *   sem parâmetro      o cardápio, em JSON puro — é o jeito que o
 *                      navegador usa (fetch comum)
 *   ?callback=nome   o mesmo cardápio embrulhado em `nome({...})` —
 *                    JSONP, só para navegador muito antigo
 *   ?ping=1          só confirma que o Web App está no ar
 *
 * Por que fetch e não JSONP? O Apps Script responde com
 * `Access-Control-Allow-Origin: *`, então um fetch comum lê a
 * resposta sem dificuldade. O JSONP exigiria que a resposta viesse
 * como `text/javascript` — e quando ela vem como `application/json`,
 * o Chrome bloqueia com ORB (Opaque Response Blocking) e o cardápio
 * fica sem nunca ler a planilha, sem aviso nenhum. O fetch não
 * depende do tipo da resposta, então não sofre com isso.
 *
 * O JSONP continua existindo como reserva. O preço dele é rodar como
 * código na origem do site, por isso validamos o nome do callback.
 *
 * A LEITURA NÃO EXIGE TOKEN — só a escrita. O cardápio é público por
 * natureza: qualquer pessoa que abra o site já vê os itens, os preços
 * e o número do WhatsApp na tela. Exigir token para ler não protege
 * nada, e ainda quebra o cliente: o site não tem token (colocá-lo no
 * planilha-site.js o deixaria visível no código da página), então o
 * cardápio voltaria a mostrar o exemplo embutido para todo mundo,
 * menos para o dono — que testa no mesmo navegador e vê funcionando.
 * O TOKEN protege o POST, que é o que realmente importa: sem ele,
 * qualquer pessoa com a URL gravaria pedidos falsos na planilha.
 */
function doGet(e) {
  var parametro = (e && e.parameter) || {};

  /* O callback vai colado no código executado. Aceitar qualquer
     caractere aqui permitiria injetar JavaScript arbitrário. */
  var bruto = String(parametro.callback || '');
  var callback = bruto.replace(/[^A-Za-z0-9_$]/g, '');
  if (bruto && !callback) return responder({ ok: false, erro: 'Callback inválido.' });

  var responderLeia = callback ? function (o) { return responderJsonp(callback, o); } : responder;

  if (parametro.ping) {
    return responder({
      ok: true,
      mensagem: 'Cardápio digital conectado. Não é preciso abrir esta URL no navegador.'
    });
  }

  /* Consulta de status: resposta leve, só o pedido. A página
     Acompanhar fica perguntando de tempo em tempo, e arrastar o
     cardápio e as configurações inteiras a cada pergunta seria
     desperdício. */
  if (parametro.pedido) {
    return responderLeia(lerStatusPedido(parametro.pedido));
  }

  /* Lista de pedidos para a página Gerenciar Pedidos.
     Aqui o token É exigido: a listagem traz nome, endereço e
     observações de cada cliente, e o doGet não tinha como distinguir
     o dono de um curioso que achasse a URL. */
  if (parametro.pedidos) {
    if (TOKEN && parametro.token !== TOKEN) {
      return responderLeia({ ok: false, erro: 'Token inválido.' });
    }
    return responderLeia(lerPedidos());
  }

  var menu;
  var config = null;
  var bairros = null;

  try {
    menu = lerCardapio();
    config = lerConfig();
    bairros = lerBairros();
  } catch (erro) {
    registrar('erro', 'leitura do cardapio: ' + erro.message);
    return responderLeia({ ok: false, erro: erro.message });
  }

  /* menu vazio e config null sao respostas legitimas: significam
     "a planilha existe mas ainda nao foi publicada". O navegador
     entende isso e mantem o que ja tinha. Bairros null (aba
     inexistente) tambem nao apaga nada; lista vazia apaga.
     chavesIgnoradas sao os rotulos da aba Config que ficaram de fora
     (so o nome, nunca o valor): e o que permite ao painel dizer que
     ha linha sobrando em vez de fingir que esta tudo certo. */
  return responderLeia({
    ok: true,
    menu: menu,
    config: config,
    bairros: bairros,
    chavesIgnoradas: CHAVES_IGNORADAS
  });
}

/* ------------------------------------------------------------------
   Leitura
   ------------------------------------------------------------------ */

/* Texto de uma celula, ou '' se a coluna nao existir na aba. */
function textoDa(linha, coluna) {
  if (!coluna) return '';
  var v = linha[coluna - 1];
  return String(v === null || v === undefined ? '' : v).trim();
}

/* Sem acento e minusculo, so para COMPARAR nomes. Nunca usar no
   texto que vai para a tela: "Porcoes" numa placa e "Porções" no
   cardapio nao e a mesma coisa para o cliente.

   O null/undefined e tratado antes do String() de proposito:
   `t || ''` transformava o booleano FALSE e o numero 0 em
   vazio, e um "Disponivel" desmarcado no Sheets voltaria como
   "existe o padrao" em vez de "nao". */
function chaveDe(t) {
  if (t === null || t === undefined) return '';

  /* O normalize('NFD') separa a letra do acento (é -> e + mark), e so
     entao a faixa de combining marks pode limpar. Sem ele, "Opção"
     pre-composto (o codigo unico é) nao casaria com "Opcao". Fica sob
     guarda porque nem toda engine antiga tem normalize. */
  var s = String(t);
  if (typeof s.normalize === 'function') s = s.normalize('NFD');

  return s
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/* "Sim"/"Nao" gravados pelo navegador. Vazio cai no padrao, que
   difere por campo: destaque vazio e falso, disponivel vazio e
   verdadeiro (item novo nasce disponivel). */
var NAO = ['nao', 'n', 'false', 'f', '0', 'off'];
function booleanoDe(valor, padrao) {
  var s = chaveDe(valor);
  if (!s) return padrao;
  return NAO.indexOf(s) < 0;
}

/* Preco aceito de varias formas, porque o dono pode ter digitado.
   A coluna vira numero na escrita, mas alguem pode colar texto,
   trocar o ponto por virgula ou escrever milhar com ponto. */
function precoDe(valor) {
  /* Numero negativo e recusado aqui tambem, e nao so no texto:
     o Store ja faz isso na normalizacao, mas a leitura nao pode
     devolver um preco que ninguem aceitaria de volta. */
  if (typeof valor === 'number') return isFinite(valor) && valor >= 0 ? valor : 0;

  var s = String(valor === null || valor === undefined ? '' : valor)
    .replace(/[^\d.,-]/g, '')
    .replace(/-/g, '')
    .trim();

  if (!s) return 0;

  var virgula = s.lastIndexOf(',');
  var ponto = s.lastIndexOf('.');

  if (virgula >= 0 && ponto >= 0) {
    /* "1.234,56" ou "1,234.56": o separador decimal e o ultimo */
    s = virgula > ponto
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (virgula >= 0) {
    /* "18,90" e decimal; "1,234" e milhar */
    s = (s.length - virgula - 1) === 3 && /^\d{1,3}(,\d{3})+$/.test(s)
      ? s.replace(/,/g, '')
      : s.replace(',', '.');
  }

  var n = parseFloat(s);
  return isFinite(n) && n >= 0 ? n : 0;
}

/* Mesma regra do linkDeImagem() do navegador, invertida: la
   removemos aspas e "=" inicial antes de gravar; aqui aceitaremos
   link absoluto http(s) OU caminho relativo (img/arquivo.jpg) para
   permitir imagens locais junto ao index.html. Caminhos relativos
   sao retornados como estao; o navegador resolve relativamente ao
   dominio/arquivo. */
function linkDe(valor) {
  var s = String(valor === null || valor === undefined ? '' : valor).trim();
  if (!s) return '';
  if (s.indexOf('data:') === 0 || s.indexOf('javascript:') === 0 || s.indexOf('=') === 0) return '';
  if (s.indexOf('#') === 0 || s.indexOf('..') === 0) return '';

  /* URL colada a mao: um espaco no meio significa que o link esta
     quebrado (cortado, copiado de PDF). */
  if (/^https?:\/\//i.test(s)) return /^[^\s"'\\<>]+$/.test(s) ? s : '';
  if (/^\/\//.test(s)) return /^[^\s"'\\<>]+$/.test(s.slice(2)) ? 'https:' + s : '';

  /* Caminho para a pasta img/ do site. Aqui espaco e acento no nome
     do arquivo sao permitidos: o navegador codifica (%20) sozinho e
     a imagem carrega. O que nao passa e aspa, <, > e barra
     invertida. */
  if (/["<>\\\n\r]/.test(s)) return '';
  return s.replace(/^\.\//, '');
}

/**
 * Monta o cardápio inteiro a partir da aba Cardápio.
 * Uma linha por item; as categorias são as linhas agrupadas, na
 * ordem em que aparecem — que é a ordem em que o donopublication
 * montou no painel.
 */
function lerCardapio() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_CARDAPIO);

  if (!aba || aba.getLastRow() < 2) return [];

  var cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var col = function (nome) { return cabecalho.indexOf(nome) + 1; };

  var colItem = col('Item');
  if (!colItem) return [];

  var colCategoria = col('Categoria');
  var colIcone = col('Icone');
  var colPreco = col('Preco');
  var colDestaque = col('Destaque');
  var colDisponivel = col('Disponivel');
  var colDescricao = col('Descricao');
  var colLink = col('Link da imagem');

  var ultima = aba.getLastRow();

  /* Uma faixa só: ler coluna a coluna custaria uma leitura por
     coluna e a cota do Google é contada por célula. */
  var valores = aba.getRange(2, 1, ultima - 1, cabecalho.length).getValues();

  var menu = [];
  var porChave = {};

  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];

    var nome = textoDa(linha, colItem);
    if (!nome) continue;

    var nomeCategoria = textoDa(linha, colCategoria) || 'Cardápio';
    var chave = chaveDe(nomeCategoria);

    var categoria = porChave[chave];

    if (!categoria) {
      categoria = { nome: nomeCategoria, icone: '', itens: [] };
      porChave[chave] = categoria;
      menu.push(categoria);
    }

    /* O icone se repete em todas as linhas da categoria; vale o
       primeiro preenchido, para o dono poder corrigir em qualquer
       linha da categoria. */
    if (!categoria.icone) categoria.icone = textoDa(linha, colIcone);

    categoria.itens.push({
      nome: nome,
      preco: precoDe(colPreco ? linha[colPreco - 1] : 0),
      destaque: booleanoDe(colDestaque ? linha[colDestaque - 1] : '', false),
      disponivel: booleanoDe(colDisponivel ? linha[colDisponivel - 1] : '', true),
      descricao: textoDa(linha, colDescricao),
      imagem: linkDe(colLink ? linha[colLink - 1] : '')
    });
  }

  /* As opções vivem numa aba à parte, casadas pelo nome do item. */
  return anexarOpcoes(menu);
}

/**
 * Lê a aba Config (chave/valor) e devolve só os campos conhecidos.
 * A coluna A aceita o nome interno ("chavePix") ou o rótulo que o dono
 * le na tela ("Chave PIX", "Cidade do recebedor") — ver
 * campoConfigDe. Chave que não corresponde a nenhum dos dois é
 * ignorada, para uma anotação na aba não entrar no cardápio, mas o
 * nome dela volta em CHAVES_IGNORADAS para o painel avisar.
 * Devolve null quando a aba não existe, para o navegador manter a
 * configuração que já tinha.
 */
function lerConfig() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_CONFIG);

  CHAVES_IGNORADAS = [];

  if (!aba || aba.getLastRow() < 2) return null;

  var valores = aba.getRange(2, 1, aba.getLastRow() - 1, 2).getValues();
  var saida = {};

  for (var i = 0; i < valores.length; i++) {
    var escrita = String(valores[i][0] || '').trim();
    if (!escrita) continue;

    var campo = campoConfigDe(escrita);
    if (!campo) {
      var ehAuditoria = LINHAS_AUDITORIA.indexOf(escrita) >= 0 ||
        LINHAS_AUDITORIA.indexOf(semAcentoConfig(escrita).toLowerCase().replace(/[^a-z0-9]/g, '')) >= 0;
      if (!ehAuditoria && CHAVES_IGNORADAS.indexOf(escrita) < 0) CHAVES_IGNORADAS.push(escrita);
      continue;
    }

    saida[campo] = campo === 'chavePix' ? chavePixLimpa(valores[i][1]) : valores[i][1];
  }

  return Object.keys(saida).length ? saida : null;
}

/**
 * Lê a aba Bairros (uma linha por bairro) e devolve a lista na ordem
 * da planilha. Devolve null quando a aba não existe — assim uma
 * planilha antiga, sem a aba, não apaga os bairros que o navegador
 * já tinha. Uma aba só com o cabeçalho devolve [], que é a resposta
 * legítima de "nenhum bairro cadastrado".
 */
function lerBairros() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_BAIRROS);

  if (!aba) return null;
  if (aba.getLastRow() < 2) return [];

  var cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var col = function (nome) { return cabecalho.indexOf(nome) + 1; };

  var colBairro = col('Bairro') || col('Nome');
  if (!colBairro) return [];

  var colTaxa = col('Taxa');
  var colTempo = col('Tempo');
  var colAtivo = col('Ativo');

  var valores = aba.getRange(2, 1, aba.getLastRow() - 1, cabecalho.length).getValues();
  var bairros = [];

  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];
    var nome = textoDa(linha, colBairro);
    if (!nome) continue;

    bairros.push({
      nome: nome,
      taxa: precoDe(colTaxa ? linha[colTaxa - 1] : 0),
      tempo: textoDa(linha, colTempo),
      ativo: booleanoDe(colAtivo ? linha[colAtivo - 1] : '', true)
    });
  }

  return bairros;
}

/**
 * Dá o status de um pedido pelo número dele (coluna "Pedido" da aba
 * Pedidos). É o que alimenta a página Acompanhar: o cliente manda o
 * número e fica perguntando de tempo em tempo.
 *
 * Devolve sempre ok:true (a pergunta foi respondida), com
 * encontrado:false quando o número não está lá — o cliente mostrou um
 * número digitado errado, e um erro no console não ajudaria em nada.
 * Um status vazio conta como "Novo": o dono que ainda não mexeu na
 * célula tem o pedido recém-chegado.
 */
function lerStatusPedido(id) {
  var alvo = String(id === null || id === undefined ? '' : id).trim();
  if (!alvo) return { ok: false, erro: 'Informe o número do pedido.' };

  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_PEDIDOS);
  if (!aba || aba.getLastRow() < 2) {
    return { ok: true, pedido: alvo, status: '', encontrado: false };
  }

  var cabecalho = aba.getRange(1, 1, 1, Math.max(1, aba.getLastColumn())).getValues()[0];
  var colPedido = acharColuna(cabecalho, ['Pedido']);
  if (!colPedido) return { ok: true, pedido: alvo, status: '', encontrado: false };

  var colStatus = acharColuna(cabecalho, ['Status']);
  var colTipo = acharColuna(cabecalho, ['Tipo']);

  var valores = aba.getRange(2, 1, aba.getLastRow() - 1, cabecalho.length).getValues();

  /* De trás para a frente: se o mesmo número aparecer duas vezes
     (reimpressão), vale o mais recente. */
  for (var i = valores.length - 1; i >= 0; i--) {
    if (String(valores[i][colPedido - 1]).trim() !== alvo) continue;

    var status = colStatus ? String(valores[i][colStatus - 1] || '').trim() : '';
    var tipo = colTipo ? String(valores[i][colTipo - 1] || '').trim().toLowerCase() : '';

    return {
      ok: true,
      pedido: alvo,
      status: status || 'Novo',
      tipo: tipo,
      encontrado: true
    };
  }

  return { ok: true, pedido: alvo, status: '', encontrado: false };
}

/**
 * Lê todos os pedidos da aba Pedidos para a página Gerenciar Pedidos.
 * Devolve uma lista com todos os pedidos, incluindo itens.
 */
function lerPedidos() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_PEDIDOS);

  if (!aba || aba.getLastRow() < 2) {
    return { ok: true, pedidos: [] };
  }

  var cabecalho = aba.getRange(1, 1, 1, Math.max(1, aba.getLastColumn())).getValues()[0];
  var colPedido = acharColuna(cabecalho, ['Pedido']);
  var colData = acharColuna(cabecalho, ['Data']);
  var colHora = acharColuna(cabecalho, ['Hora']);
  var colCliente = acharColuna(cabecalho, ['Cliente']);
  var colTipo = acharColuna(cabecalho, ['Tipo']);
  var colEndereco = acharColuna(cabecalho, ['Endereco']);
  var colBairro = acharColuna(cabecalho, ['Bairro']);
  var colPagamento = acharColuna(cabecalho, ['Pagamento']);
  var colSubtotal = acharColuna(cabecalho, ['Subtotal']);
  var colTaxa = acharColuna(cabecalho, ['Taxa entrega']);
  var colTotal = acharColuna(cabecalho, ['TOTAL']);
  var colObservacoes = acharColuna(cabecalho, ['Observacoes']);
  var colStatus = acharColuna(cabecalho, ['Status']);
  var colItens = acharColuna(cabecalho, ['Itens do pedido']);

  if (!colPedido) return { ok: true, pedidos: [] };

  var valores = aba.getRange(2, 1, aba.getLastRow() - 1, cabecalho.length).getValues();
  var pedidos = [];

  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];
    var pedido = String(linha[colPedido - 1] || '').trim();
    if (!pedido) continue;

    pedidos.push({
      pedido: pedido,
      data: colData ? String(linha[colData - 1] || '').trim() : '',
      hora: colHora ? String(linha[colHora - 1] || '').trim() : '',
      cliente: colCliente ? String(linha[colCliente - 1] || '').trim() : '',
      tipo: colTipo ? String(linha[colTipo - 1] || '').trim() : '',
      endereco: colEndereco ? String(linha[colEndereco - 1] || '').trim() : '',
      bairro: colBairro ? String(linha[colBairro - 1] || '').trim() : '',
      pagamento: colPagamento ? String(linha[colPagamento - 1] || '').trim() : '',
      subtotal: colSubtotal ? Number(linha[colSubtotal - 1]) || 0 : 0,
      taxa: colTaxa ? Number(linha[colTaxa - 1]) || 0 : 0,
      total: colTotal ? Number(linha[colTotal - 1]) || 0 : 0,
      observacoes: colObservacoes ? String(linha[colObservacoes - 1] || '').trim() : '',
      status: colStatus ? String(linha[colStatus - 1] || '').trim() || 'Novo' : 'Novo',
      itens: colItens ? String(linha[colItens - 1] || '').trim() : ''
    });
  }

  return { ok: true, pedidos: pedidos };
}

/**
 * Altera o status de um pedido na aba Pedidos.
 */
function alterarStatusPedido(pedido, novoStatus) {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_PEDIDOS);

  if (!aba || aba.getLastRow() < 2) {
    return { ok: false, erro: 'Aba Pedidos não encontrada.' };
  }

  var cabecalho = aba.getRange(1, 1, 1, Math.max(1, aba.getLastColumn())).getValues()[0];
  var colPedido = acharColuna(cabecalho, ['Pedido']);
  var colStatus = acharColuna(cabecalho, ['Status']);

  if (!colPedido || !colStatus) {
    return { ok: false, erro: 'Colunas Pedido ou Status não encontradas.' };
  }

  var valores = aba.getRange(2, 1, aba.getLastRow() - 1, cabecalho.length).getValues();

  /* De trás para a frente, igual ao lerStatusPedido: se o mesmo número
     aparecer duas vezes (impressão reprovada, linha copiada), vale a
     mais recente — é o pedido que o cliente acabou de fazer. Vale
     menos que o cliente conferir o número antes de gravar, mas cobre
     o resto. */
  for (var i = valores.length - 1; i >= 0; i--) {
    if (String(valores[i][colPedido - 1]).trim() === pedido) {
      aba.getRange(i + 2, colStatus).setValue(novoStatus);
      registrar('alterarStatus', 'Pedido ' + pedido + ' → ' + novoStatus);
      return { ok: true, pedido: pedido, status: novoStatus };
    }
  }

  return { ok: false, erro: 'Pedido ' + pedido + ' não encontrado.' };
}

/**
 * Apaga todos os pedidos e todos os itens, para o dono começar do zero.
 *
 * É uma ação destrutiva, então exige DUAS coisas: o token (que o
 * doPost já cobra de toda escrita) e a frase de confirmação exata
 * vinda do painel. Um clique sozinho não apaga nada — o painel só
 * envia a frase depois de o dono ver um "digite para confirmar".
 *
 * Apaga as linhas 2..N e MANTÉM a linha 1 (cabeçalho) e a formatação,
 * ao contrário do `replace` (que usa clearContents e perderia o
 * negrito, a largura das colunas e a formatação de dinheiro).
 *
 * A aba Relatorio é reconstruida na hora: ela é só conta, não dado.
 * Sem isso, a tela mostraria o total dos pedidos apagados até o
 * próximo pedido entrar.
 */
function limparPedidos(confirmacao) {
  /* Comparação exata, sem tolerar caixa nem espaço sobrando: a frase
     é longa de propósito, para o painel não aceitar por engano. */
  if (confirmacao !== FRASE_LIMPAR) {
    return {
      ok: false,
      erro: 'Confirmação incorreta. Nada foi apagado.'
    };
  }

  var apagados = {};
  var planilha = SpreadsheetApp.getActiveSpreadsheet();

  try {
    /* getSheetByName e nao abaOuCriar: nao faz sentido criar uma aba
       que o dono nunca teve, porque ela nasceria sem cabecalho e o
       painel mostraria uma aba nova e vazia no meio da planilha. */
    apagados[ABA_PEDIDOS] = apagarDados(planilha, ABA_PEDIDOS);
    apagados[ABA_ITENS] = apagarDados(planilha, ABA_ITENS);

    /* A conta precisa bater com o que sobrou, e não com o histórico. */
    gerarRelatorio();
  } catch (erro) {
    registrar('erro', 'limpar: ' + erro.message);
    return { ok: false, erro: erro.message, apagados: apagados };
  }

  registrar('limpar', 'apagados ' + apagados[ABA_PEDIDOS] + ' pedido(s) e ' +
    apagados[ABA_ITENS] + ' item(ns)');

  return { ok: true, apagados: apagados };
}

/* Apaga as linhas de dados de uma aba e devolve quantas foram.
 * Devolve 0 quando a aba não existe ou já está só com o cabeçalho —
 * limpar duas vezes não pode dar erro. */
function apagarDados(planilha, nome) {
  var aba = planilha.getSheetByName(nome);
  if (!aba) return 0;

  var dados = aba.getLastRow() - 1;
  if (dados < 1) return 0;

  aba.deleteRows(2, dados);
  return dados;
}

/* Acha o número da coluna pelo nome, ignorando acento e caixa. Assim
   tanto faz o dono escrever "Opcao" (como o painel grava) ou "Opção",
   "Preco" ou "Preço". Devolve 0 quando não existe. */
function acharColuna(cabecalho, nomes) {
  for (var i = 0; i < cabecalho.length; i++) {
    var h = chaveDe(cabecalho[i]);
    for (var j = 0; j < nomes.length; j++) {
      if (h === chaveDe(nomes[j])) return i + 1;
    }
  }
  return 0;
}

/**
 * Lê a aba Opcoes (uma linha por opção) e devolve um mapa por nome de
 * item: { "x-burguer": [ { grupo, tipo, obrigatorio, itens: [...] } ] }.
 * Devolve um mapa vazio quando a aba não existe, para uma planilha
 * antiga continuar funcionando sem opções.
 *
 * Um grupo é único (radio) quando o campo Tipo não é "multiplo" —
 * assim o caso mais comum (Tamanho, Ponto) já sai certo sem o dono
 * precisar preencher nada.
 */
function lerOpcoes() {
  var mapa = {};
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_OPCOES);

  if (!aba || aba.getLastRow() < 2) return mapa;

  var cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];

  var colItem = acharColuna(cabecalho, ['Item']);
  var colGrupo = acharColuna(cabecalho, ['Grupo']);
  var colOpcao = acharColuna(cabecalho, ['Opcao']);
  if (!colItem || !colGrupo || !colOpcao) return mapa;

  var colTipo = acharColuna(cabecalho, ['Tipo']);
  var colPreco = acharColuna(cabecalho, ['Preco']);
  var colObrig = acharColuna(cabecalho, ['Obrigatorio']);

  var valores = aba.getRange(2, 1, aba.getLastRow() - 1, cabecalho.length).getValues();

  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];
    var nomeItem = textoDa(linha, colItem);
    var nomeGrupo = textoDa(linha, colGrupo);
    var nomeOpcao = textoDa(linha, colOpcao);
    if (!nomeItem || !nomeGrupo || !nomeOpcao) continue;

    var itemChave = chaveDe(nomeItem);
    var grupos = mapa[itemChave] || (mapa[itemChave] = []);
    var grupoChave = chaveDe(nomeGrupo);
    var grupo = null;

    for (var g = 0; g < grupos.length; g++) {
      if (chaveDe(grupos[g].grupo) === grupoChave) { grupo = grupos[g]; break; }
    }

    if (!grupo) {
      grupo = {
        grupo: nomeGrupo,
        tipo: chaveDe(colTipo ? linha[colTipo - 1] : '') === 'multiplo' ? 'multiplo' : 'unico',
        obrigatorio: booleanoDe(colObrig ? linha[colObrig - 1] : '', false),
        itens: []
      };
      grupos.push(grupo);
    }

    grupo.itens.push({
      nome: nomeOpcao,
      preco: precoDe(colPreco ? linha[colPreco - 1] : 0)
    });
  }

  return mapa;
}

/**
 * Anexa as opções de cada grupo ao item de mesmo nome no cardápio.
 * O casamento é por nome (sem acento e sem caixa), porque é o que a
 * planilha guarda na coluna Item da aba Opcoes.
 */
function anexarOpcoes(menu) {
  if (!menu || !menu.length) return menu;

  var mapa = lerOpcoes();
  if (!Object.keys(mapa).length) return menu;

  for (var i = 0; i < menu.length; i++) {
    var itens = menu[i].itens || [];

    for (var j = 0; j < itens.length; j++) {
      var grupos = mapa[chaveDe(itens[j].nome)];
      if (grupos && grupos.length) itens[j].opcoes = grupos;
    }
  }

  return menu;
}

/* ------------------------------------------------------------------
   Relatorio de vendas
   ------------------------------------------------------------------ */

/* 1 -> A, 26 -> Z, 27 -> AA. Usado para montar o endereco das
   formulas a partir do nome da coluna, sem chumbar letras. */
function letraColuna(n) {
  var s = '';
  while (n > 0) {
    var resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/* Acha a letra da coluna pelo nome do cabecalho. Devolve '' quando a
   aba nao existe ou a coluna nao esta la. */
function letraDaColuna(aba, nome) {
  if (!aba || aba.getLastRow() < 1) return '';

  var cabecalho = aba.getRange(1, 1, 1, Math.max(1, aba.getLastColumn())).getValues()[0];

  for (var i = 0; i < cabecalho.length; i++) {
    if (chaveDe(cabecalho[i]) === chaveDe(nome)) return letraColuna(i + 1);
  }
  return '';
}

/* Valores nao-vazios de uma coluna, sem repetir e na ordem em que
   aparecem. E o que da a lista de itens e a de dias do relatorio. */
function valoresUnicos(aba, numeroColuna) {
  var vistos = {};
  var lista = [];
  if (!aba || !numeroColuna || aba.getLastRow() < 2) return lista;

  var valores = aba.getRange(2, numeroColuna, aba.getLastRow() - 1, 1).getValues();

  for (var i = 0; i < valores.length; i++) {
    var v = valores[i][0];
    if (v === '' || v === null || v === undefined) continue;
    var chave = chaveDe(v);
    if (vistos[chave]) continue;
    vistos[chave] = true;
    lista.push(v);
  }

  return lista;
}

/* Numero da coluna a partir da letra (A -> 1). */
function numeroColuna(letra) {
  var n = 0;
  for (var i = 0; i < letra.length; i++) {
    n = n * 26 + (letra.charCodeAt(i) - 64);
  }
  return n;
}

/**
 * Monta a aba Relatorio a partir das abas Pedidos e Itens.
 *
 * Usa formulas (SOMASE/CONT.SE) em vez de numeros calculados: assim o
 * dono pode editar um pedido na mao e o relatorio acompanha. A LISTA
 * de itens e de dias, essa, e reescrita a cada pedido — e o que faz
 * um item ou um dia novo aparecer sem o dono mexer em nada.
 *
 * Se uma das abas nao existir (nunca houve pedido), o relatorio sai
 * so com os titulos e as formulas nao quebram: SUMIF de intervalo
 * vazio devolve 0, e IFERROR cobre a divisao por zero.
 */
function gerarRelatorio() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var itens = planilha.getSheetByName(ABA_ITENS);
  var pedidos = planilha.getSheetByName(ABA_PEDIDOS);

  var aba = planilha.getSheetByName(ABA_RELATORIO);
  if (aba) aba.clear();
  else aba = planilha.insertSheet(ABA_RELATORIO);

  /* Referencias (coluna inteira, para pegar linhas futuras). */
  var refItem = itens ? letraDaColuna(itens, 'Item') : '';
  var refQtd = itens ? letraDaColuna(itens, 'Quantidade') : '';
  var refValorItem = itens ? letraDaColuna(itens, 'Total do item') : '';
  var refDataPed = pedidos ? letraDaColuna(pedidos, 'Data') : '';
  var refTotalPed = pedidos ? letraDaColuna(pedidos, 'TOTAL') : '';
  var refNumPed = pedidos ? letraDaColuna(pedidos, 'Pedido') : '';

  var refItensItem = refItem ? 'Itens!$' + refItem + ':$' + refItem : '';
  var refItensQtd = refQtd ? 'Itens!$' + refQtd + ':$' + refQtd : '';
  var refItensValor = refValorItem ? 'Itens!$' + refValorItem + ':$' + refValorItem : '';
  var refPedData = refDataPed ? 'Pedidos!$' + refDataPed + ':$' + refDataPed : '';
  var refPedTotal = refTotalPed ? 'Pedidos!$' + refTotalPed + ':$' + refTotalPed : '';

  var linha = 1;

  aba.getRange(linha, 1).setValue('Relatório de vendas');
  aba.getRange(linha, 1).setFontWeight('bold');
  linha += 1;

  aba.getRange(linha, 1).setValue('Atualizado em');
  aba.getRange(linha, 2).setValue(new Date());
  linha += 2;

  /* --- Resumo geral --- */
  aba.getRange(linha, 1).setValue('Resumo');
  aba.getRange(linha, 1).setFontWeight('bold');
  linha += 1;

  var linhaPedidos = linha;
  aba.getRange(linha, 1).setValue('Pedidos');
  if (refNumPed) {
    aba.getRange(linha, 2).setFormula('=COUNTA(Pedidos!$' + refNumPed + '$2:$' + refNumPed + ')');
  }
  linha += 1;

  var linhaFaturamento = linha;
  aba.getRange(linha, 1).setValue('Faturamento');
  if (refTotalPed) {
    aba.getRange(linha, 2).setFormula('=SUM(Pedidos!$' + refTotalPed + '$2:$' + refTotalPed + ')');
  }
  linha += 1;

  aba.getRange(linha, 1).setValue('Ticket medio');
  aba.getRange(linha, 2).setFormula('=IFERROR(B' + linhaFaturamento + '/B' + linhaPedidos + ',0)');
  linha += 2;

  /* --- Por item --- */
  aba.getRange(linha, 1).setValue('Por item');
  aba.getRange(linha, 1).setFontWeight('bold');
  linha += 1;
  aba.getRange(linha, 1, 1, 3).setValues([['Item', 'Quantidade', 'Total']]);
  aba.getRange(linha, 1, 1, 3).setFontWeight('bold');
  linha += 1;

  var nomes = valoresUnicos(itens, numeroColuna(refItem));
  for (var i = 0; i < nomes.length; i++) {
    aba.getRange(linha, 1).setValue(nomes[i]);
    if (refItem && refQtd) {
      aba.getRange(linha, 2).setFormula('=SUMIF(' + refItensItem + ',$A' + linha + ',' + refItensQtd + ')');
    }
    if (refItem && refValorItem) {
      aba.getRange(linha, 3).setFormula('=SUMIF(' + refItensItem + ',$A' + linha + ',' + refItensValor + ')');
    }
    linha += 1;
  }

  linha += 1;

  /* --- Por dia --- */
  aba.getRange(linha, 1).setValue('Por dia');
  aba.getRange(linha, 1).setFontWeight('bold');
  linha += 1;
  aba.getRange(linha, 1, 1, 4).setValues([['Data', 'Pedidos', 'Total', 'Ticket medio']]);
  aba.getRange(linha, 1, 1, 4).setFontWeight('bold');
  linha += 1;

  var dias = valoresUnicos(pedidos, numeroColuna(refDataPed));
  for (var d = 0; d < dias.length; d++) {
    aba.getRange(linha, 1).setValue(dias[d]);
    if (refDataPed) {
      aba.getRange(linha, 2).setFormula('=COUNTIF(' + refPedData + ',$A' + linha + ')');
    }
    if (refDataPed && refTotalPed) {
      aba.getRange(linha, 3).setFormula('=SUMIF(' + refPedData + ',$A' + linha + ',' + refPedTotal + ')');
    }
    aba.getRange(linha, 4).setFormula('=IFERROR(C' + linha + '/B' + linha + ',0)');
    linha += 1;
  }

  /* Uma coluna larga para o "Ticket medio" nao nascer cortado. */
  aba.setColumnWidth(1, 220);
  aba.setColumnWidth(3, 120);
  aba.setColumnWidth(4, 120);

  registrar('relatorio', nomes.length + ' item(ns), ' + dias.length + ' dia(s)');
  return { itens: nomes.length, dias: dias.length };
}

/**
 * Empacota o JSON numa chamada de função. É o truque do JSONP, e
 * só entra em uso por navegador muito antigo: o texto devolvido
 * precisa ser JavaScript válido, não JSON puro.
 */
function responderJsonp(callback, objeto) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(objeto) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/* ------------------------------------------------------------------
   Escrita
   ------------------------------------------------------------------ */
function escreverAba(spec, acao, origem) {
  var cabecalho = spec.cabecalho || [];
  var linhas = spec.linhas || [];

  /* No modo replace, zero linhas é válido e significa "limpar a
     aba" (ex.: o dono apagou todos os bairros). No append, sem
     linhas não há o que fazer. */
  if (!linhas.length && spec.modo !== 'replace') {
    return { aba: spec.nome, linhas: 0, pulada: true };
  }

  var aba = abaOuCriar(spec.nome);

  if (spec.modo === 'replace') {
    /* Estado atual, não histórico: o que vale é a última versão.
       clearContents tira texto e formatação; clear() também apagaria
       linhas e colunas que sobraram da versão anterior. */
    aba.clearContents();
    aba.getRange(1, 1, linhas.length + 1, cabecalho.length)
       .setValues([cabecalho].concat(linhas));
  } else {
    /* Append: só cria o cabeçalho se a aba ainda está vazia, para
       não repetir a linha de título a cada pedido. */
    if (aba.getLastRow() === 0) {
      aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
      aba.setFrozenRows(1);
    } else {
      sincronizarCabecalho(aba, cabecalho);
    }
    aba.getRange(aba.getLastRow() + 1, 1, linhas.length, linhas[0].length)
       .setValues(linhas);
  }

  cabecalhoNegrito(aba, cabecalho.length);
  aplicarPrecos(aba, cabecalho);
  aplicarPrecosConfig(aba);
  aplicarLinksImagem(aba, cabecalho);

  registrar(acao, spec.nome + ' · ' + linhas.length + ' linha(s) · ' + origem);

  return { aba: spec.nome, linhas: linhas.length };
}

/* Estende o cabeçalho de uma aba que já existia quando o código
   ganha uma coluna nova (ex.: "Bairro" na aba Pedidos). Sem isso, a
   coluna extra ficaria sem título e o dono não saberia o que é. Só
   escreve as colunas que faltam, para não mexer no que já está lá. */
function sincronizarCabecalho(aba, cabecalho) {
  /* Escreve TODAS as colunas do cabeçalho, não apenas as que faltam.
     Se a planilha foi criada antes de uma coluna nova ser adicionada
     (ex.: Bairro), a coluna pode não estar sendo escrita corretamente. */
  for (var i = 0; i < cabecalho.length; i++) {
    aba.getRange(1, i + 1).setValue(cabecalho[i]);
  }
}

function cabecalhoNegrito(aba, colunas) {
  aba.getRange(1, 1, 1, colunas).setFontWeight('bold');
}

function abaOuCriar(nome) {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(nome);
  if (!aba) aba = planilha.insertSheet(nome);
  return aba;
}

/**
 * Preços chegam como número do navegador, então basta dizer ao
 * Sheets que a coluna é dinheiro. Sem isso a coluna vira texto e
 * a soma do total dá erro.
 */
function aplicarPrecos(aba, cabecalho) {
  var dinheiro = ['Subtotal', 'Taxa entrega', 'TOTAL', 'Preco unitario', 'Total do item'];

  for (var i = 0; i < cabecalho.length; i++) {
    if (dinheiro.indexOf(cabecalho[i]) < 0) continue;

    var ultima = aba.getLastRow();
    if (ultima < 2) continue;

    aba.getRange(2, i + 1, ultima - 1, 1).setNumberFormat('R$ #,##0.00');
  }
}

/**
 * Na aba Config os valores ficam na coluna "Valor", uma linha por
 * chave — então procurar pelo nome do cabeçalho não acha nada.
 * Aqui a coluna é varrida e só as linhas de dinheiro recebem
 * formato: são duas células, o custo é irrelevante.
 */
function aplicarPrecosConfig(aba) {
  var dinheiro = ['taxaEntrega', 'pedidoMinimo'];
  var ultima = aba.getLastRow();
  if (ultima < 2) return;

  var chaves = aba.getRange(2, 1, ultima - 1, 1).getValues();

  for (var i = 0; i < chaves.length; i++) {
    if (dinheiro.indexOf(String(chaves[i][0] || '').trim()) < 0) continue;
    aba.getRange(i + 2, 2).setNumberFormat('R$ #,##0.00');
  }
}

/**
 * A coluna "Link da imagem" vira hyperlink de verdade. setValues
 * deixa a URL como texto simples, e no Sheets texto simples só
 * fica clicável depois que alguém digita Enter na célula. Isso
 * aqui já deixa pronto para clicar direto.
 *
 * richTextValues é o que faz a parte clicável. Sem ele, seria
 * necessário montar =HIPERLINK() e aí quebrava se a URL tivesse
 * aspas ou espaços.
 */
/**
 * A coluna "Link da imagem" vira hyperlink de verdade. setValues
 * deixa a URL como texto simples, e no Sheets texto simples só
 * fica clicável depois que alguém digita Enter na célula. Isso
 * aqui já deixa pronto para clicar direto.
 *
 * richTextValues é o que faz a parte clicável. Sem ele, seria
 * necessário montar =HIPERLINK() e aí quebrava se a URL tivesse
 * aspas ou espaços.
 */
function aplicarLinksImagem(aba, cabecalho) {
  var coluna = cabecalho.indexOf('Link da imagem') + 1;
  if (!coluna) return;

  var ultima = aba.getLastRow();
  if (ultima < 2) return;

  var range = aba.getRange(2, coluna, ultima - 1, 1);
  var valores = range.getValues();

  var richArr = [];
  var temLinkValido = false;

  for (var i = 0; i < valores.length; i++) {
    var cel = valores[i][0];
    var url = String(cel === null || cel === undefined ? '' : cel).trim();

    if (url && /^https?:\/\/\S+$/i.test(url)) {
      // Link válido → cria RichText com hyperlink
      richArr.push([{
        text: url,
        textLink: { url: url }
      }]);
      temLinkValido = true;
    } else {
      // Sem link válido → RichText vazio (sem hyperlink)
      richArr.push([{
        text: '',
        textLink: null
      }]);
    }
  }

  // Só aplica se tiver pelo menos um link válido.
  // Isso evita o erro de assinatura quando todos estão vazios.
  if (temLinkValido) {
    range.setRichTextValues(richArr);
  }
}

/* ------------------------------------------------------------------
   Histórico das chamadas
   O POST chega em no-cors, então o navegador do cliente não lê a
   resposta. Sem esta aba o dono não tem como descobrir por que um
   pedido não apareceu.
   ------------------------------------------------------------------ */
function registrar(acao, detalhe) {
  try {
    var aba = abaOuCriar('Registro');

    if (aba.getLastRow() === 0) {
      aba.getRange(1, 1, 1, 3).setValues([['Quando', 'Ação', 'Detalhe']]);
      aba.getRange(1, 1, 1, 3).setFontWeight('bold');
      aba.setFrozenRows(1);
    }

    aba.appendRow([new Date(), acao, detalhe]);
  } catch (e) {
    /* O registro é conforto, não requisito. Se ele falhar, o pedido
       já foi gravado e não vale perder o envio por causa disso. */
  }
}

/**
 * ContentService não define status HTTP, então não dá para
 * responder 403/500 de verdade. O código de erro volta no corpo
 * e a aba Registro é quem registra o resto.
 */
function responder(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}