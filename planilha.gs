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
 * TOKEN é opcional. Preencha aqui e no painel para impedir que
 * qualquer pessoa com a URL escreva na sua planilha. Quem souber o
 * token ainda pode ler e apagar a planilha — é proteção contra
 * alguém que achou a URL, não contra quem tem acesso ao arquivo.
 */

var TOKEN = '';           // deixe vazio para não exigir token

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
  'mensagemFechado', 'pedirNome', 'pedirEntrega'
];

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

  return responder({ ok: true, abas: resumo });
}

/**
 * GET serve para duas coisas:
 *
 *   ?callback=nome   devolve o cardápio publicado (abas Cardápio e
 *                    Config) embrulhado em `nome({...})` — é JSONP
 *   sem callback     só confirma que o Web App está no ar
 *
 * Por que JSONP e não um fetch normal? O ContentService do Apps
 * Script não manda cabeçalhos CORS, então um GET com fetch seria
 * barrado pelo navegador. O JSONP contorna isso: o navegador não
 * bloqueia <script> de outra origem, e a resposta é executada
 * como função dentro da nossa página.
 *
 * O preço disso é que o JSONP roda como código na origem do site.
 * Por isso validamos o nome do callback e exigimos o mesmo TOKEN
 * da escrita quando ele estiver configurado.
 */
function doGet(e) {
  var parametro = (e && e.parameter) || {};

  if (!parametro.callback) {
    return responder({
      ok: true,
      mensagem: 'Cardápio digital conectado. Não é preciso abrir esta URL no navegador.'
    });
  }

  /* O callback vai colado no código executado. Aceitar qualquer
     caractere aqui permitiria injetar JavaScript arbitrário. */
  var callback = String(parametro.callback).replace(/[^A-Za-z0-9_$]/g, '');
  if (!callback) return responder({ ok: false, erro: 'Callback inválido.' });

  if (TOKEN && String(parametro.token || '') !== TOKEN) {
    return responderJsonp(callback, { ok: false, erro: 'Token inválido.' });
  }

  var menu;
  var config = null;

  try {
    menu = lerCardapio();
    config = lerConfig();
  } catch (erro) {
    registrar('erro', 'leitura do cardapio: ' + erro.message);
    return responderJsonp(callback, { ok: false, erro: erro.message });
  }

  /* menu vazio e config null sao respostas legitimas: significam
     "a planilha existe mas ainda nao foi publicada". O navegador
     entende isso e mantem o que ja tinha. */
  return responderJsonp(callback, { ok: true, menu: menu, config: config });
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

  return String(t)
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
   sao retornados como estao para o JSONP; o navegador resolve
   relativamente ao dominio/arquivo. */
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

  return menu;
}

/**
 * Lê a aba Config (chave/valor) e devolve só os campos conhecidos.
 * Chave fora da lista é ignorada: se alguém digitar um título ou
 * deixar anotação na aba, ela não entra no cardápio.
 * Devolve null quando a aba não existe, para o navegador manter a
 * configuração que já tinha.
 */
function lerConfig() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_CONFIG);

  if (!aba || aba.getLastRow() < 2) return null;

  var valores = aba.getRange(2, 1, aba.getLastRow() - 1, 2).getValues();
  var saida = {};

  for (var i = 0; i < valores.length; i++) {
    var chave = String(valores[i][0] || '').trim();
    if (CAMPOS_CONFIG.indexOf(chave) < 0) continue;
    saida[chave] = valores[i][1];
  }

  return Object.keys(saida).length ? saida : null;
}

/**
 * Empacota o JSON numa chamada de função. É o truque do JSONP:
 * o texto devolvido precisa ser JavaScript válido, não JSON puro.
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

  if (!linhas.length) return { aba: spec.nome, linhas: 0, pulada: true };

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
      cabecalhoNegrito(aba, cabecalho.length);
      aba.setFrozenRows(1);
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
function aplicarLinksImagem(aba, cabecalho) {
  var coluna = cabecalho.indexOf('Link da imagem') + 1;
  if (!coluna) return;

  var ultima = aba.getLastRow();
  if (ultima < 2) return;

  var valores = aba.getRange(2, coluna, ultima - 1, 1)
                  .getValues()
                  .map(function (l) { return l[0]; });

  var texto = [];
  var link = [];

  for (var i = 0; i < valores.length; i++) {
    var url = String(valores[i] === null ? '' : valores[i]).trim();

    if (!url || !/^https?:\/\/\S+$/i.test(url)) {
      texto.push('');
      link.push('');
      continue;
    }

    texto.push(url);
    link.push(url);
  }

  aba.getRange(2, coluna, ultima - 1, 1)
     .setRichTextValues(texto.map(function (t, i) {
       return [{
         text: t,
         textLink: link[i] ? { url: link[i] } : null
       }];
     }));
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