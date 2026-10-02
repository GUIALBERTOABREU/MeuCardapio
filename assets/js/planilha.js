/* =========================================================
   Cardapio digital - integracao com Google Sheets
   =========================================================
   Fala com um Apps Script (Web App) que appenda linhas na
   planilha. Sem chave de API, sem custo, sem SDK do Google.

   Por que fetch e nao <form>?
   ---------------------
   Um POST comum de navegador para script.google.com dispara
   preflight (OPTIONS) por causa do Content-Type, e a resposta
   do Apps Script vem sem cabecalhos CORS. O resultado seria
   "CORS policy: No 'Access-Control-Allow-Origin' header".

   A saida e POST com mode: 'no-cors': o navegador NAO faz
   preflight e NAO bloqueia a resposta, mas tambem nao deixa
   ler o que o servidor devolveu. Por isso o codigo nao pode
   depender do retorno para dizer se deu certo - ele so
   detecta falha de rede. Quem confirma a gravacao e a propria
   planilha (e a aba "Registro", que o script preenche).
   ========================================================= */
(function () {
  'use strict';

  var CHAVE_LOCAL = 'cardapio:planilha:ultimo';

  var CABECALHO_PEDIDOS = [
    'Data', 'Hora', 'Pedido', 'Cliente', 'Tipo', 'Endereco', 'Pagamento',
    'Qtd itens', 'Subtotal', 'Taxa entrega', 'TOTAL', 'Observacoes',
    'Itens do pedido', 'Obs por item'
  ];

  var CABECALHO_ITENS = [
    'Data', 'Hora', 'Pedido', 'Cliente', 'Item', 'Quantidade',
    'Preco unitario', 'Total do item', 'Observacao'
  ];

  var CABECALHO_CARDAPIO = [
    'Categoria', 'Icone', 'Item', 'Preco', 'Destaque', 'Disponivel',
    'Descricao', 'Link da imagem', 'Atualizado'
  ];

  var CABECALHO_CONFIG = ['Chave', 'Valor'];

  /* Mesma lista do planilha.gs. planilhaUrl e planilhaToken ficam de
     fora: a URL e o que diz onde ler, entao pedir isso a planilha
     seria circular. */
  var CAMPOS_CONFIG = [
    'nome', 'descricao', 'whatsapp', 'mensagemAbertura', 'corPrimaria',
    'simboloMoeda', 'taxaEntrega', 'pedidoMinimo', 'aberto',
    'mensagemFechado', 'pedirNome', 'pedirEntrega'
  ];

  /* ---------------------------------------------------------
     1. Utilidades
     --------------------------------------------------------- */
  function cfg() {
    return (window.CardapioStore && window.CardapioStore.dados().config) || {};
  }

  function configurada() {
    return !!cfg().planilhaUrl;
  }

  /* A URL que a gente publica no painel é a do POST:
     https://script.google.com/macros/s/ID/exec

     Mas dá para copiar direto da aba "Registro" a linha que o
     GET do cardápio deixou no histórico, que já vem com
     "?callback=cardapioLer1&token=...". Colar isso no campo dá
     na mesma coisa — desde que a gente tire esses dois
     parâmetros e monte a URL de novo, senão sobra "??" e o token
     vai duas vezes. Por isso a limpeza acontece aqui, e não no
     campo, para o dono continuar vendo o que ele colou. */
  function base() {
    return String(cfg().planilhaUrl || '')
      .replace(/[?&]callback=[^&#]*/gi, '')
      .replace(/[?&]token=[^&#]*/gi, '')
      .replace(/[?&]+$/, '');
  }

  /* Junta parâmetros na URL sem duplicar o "?" ou o "&". */
  function comParams(extra) {
    var b = base();
    return extra ? b + (b.indexOf('?') < 0 ? '?' : '&') + extra : b;
  }

  /* O token vem do campo próprio, mas se o dono colou a URL com
     ?token=... e deixou o campo vazio, aproveitamos o que veio
     colado em vez de mandar token vazio e tomar "Token inválido". */
  function token() {
    var proprio = cfg().planilhaToken;
    if (proprio) return String(proprio);

    var colado = /[?&]token=([^&#]*)/i.exec(String(cfg().planilhaUrl || ''));
    return colado ? decodeURIComponent(colado[1]) : '';
  }

  function origem() {
    var host = 'local';
    try { host = location.hostname || 'local'; } catch (e) { /* sem location */ }
    return host;
  }

  /* Tira acento e o que o Sheets leria como separador de coluna.
     A faixa de combining marks e \u0300-\u036f: escrever os
     caracteres literais aqui deixa o arquivo depender da
     codificacao com que foi salvo. */
  function semAcento(t) {
    var s = String(t === null || t === undefined ? '' : t);
    /* normalize() nao existe em navegadores muito antigos nem em
       algumas WebViews; nesse caso o texto segue com acento,
       que ainda e melhor do que perder o texto inteiro. */
    if (typeof s.normalize === 'function') s = s.normalize('NFD');
    return s
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s\-.,:;()\/@+*#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Texto que vai para uma celula e volta para a tela do cliente.
     NAO passa por semAcento: "Porcoes" numa placa de cardapio e
     "Batata Cheddar Bacon" sao texto corrompido. Tiramos so o que
     o Sheets interpretaria errado — quebra de linha viraria outra
     linha da tabela, aspa abriria texto, "=" no começo e formula
     e "'" no começo e marcador de texto.

     O trim vem ANTES da limpeza do primeiro caractere: com um
     espaço na frente, o "^=" não achava a fórmula e o texto
     voltaria da planilha como erro do Sheets.

     E o "-" inicial NÃO é removido de propósito. Ele não abre
     fórmula no Sheets, e comer um caractere do nome do produto é
     exatamente o tipo de texto corrompido que este resto do
     arquivo existe para evitar. */
  function textoCelula(valor) {
    var s = String(valor === null || valor === undefined ? '' : valor).trim();
    return s
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/"/g, '')
      .replace(/^[=']/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* URL de imagem.

     Mesma regra do linkDe() do planilha.gs, invertida: aqui só
     passa o que a leitura vai aceitar. As duas pontas precisam
     concordar, senão o dono vê a URL na planilha e a imagem não
     aparece no cardápio — que era o que acontecia com um link
     relativo ou um javascript: aceito aqui e recusado lá. */
  function linkDeImagem(valor) {
    var s = String(valor === null || valor === undefined ? '' : valor).trim();
    return /^https?:\/\/[^\s"'\\<>]+$/i.test(s) ? s : '';
  }

  /* Preco vai como numero, nao como "18,90": o Sheets precisa
     reconhecer a coluna como dinheiro para somar e filtrar. */
  function dinheiro(valor) {
    var n = Number(valor);
    return isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  function lista(itens, campo) {
    return itens.map(function (i) { return semAcento(i[campo] || ''); }).join(' | ');
  }

  function dataHora() {
    var agora = new Date();
    return {
      data: agora.toLocaleDateString('pt-BR'),
      hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  }

  /* ---------------------------------------------------------
     2. Montagem das linhas
     --------------------------------------------------------- */
  function linhaDoPedido(p, itens) {
    return [
      p.data,
      p.hora,
      p.pedido || '',
      semAcento(p.cliente),
      p.tipo === 'retirada' ? 'Retirada' : 'Entrega',
      /* O Sheets le "/" como divisão e "," como separador de coluna
         dentro do campo, então a vírgula do CEP sai junto. */
      semAcento(p.endereco).replace(/,/g, ''),
      semAcento(p.pagamento),
      itens.length,
      dinheiro(p.subtotal),
      dinheiro(p.taxa),
      dinheiro(p.total),
      semAcento(p.observacoes),
      itens.map(function (i) {
        return i.quantidade + 'x ' + semAcento(i.nome) + ' (' + dinheiro(i.precoUnitario) + ')';
      }).join(' | '),
      itens.map(function (i) { return semAcento(i.observacao); }).filter(Boolean).join(' | ')
    ];
  }

  /* Formato longo: uma linha por item. E o que permite somar
     quanto saiu de cada produto na aba. */
  function linhasDoPedido(itens, p) {
    return itens.map(function (i) {
      return [
        p.data,
        p.hora,
        p.pedido || '',
        semAcento(p.cliente),
        semAcento(i.nome),
        i.quantidade,
        dinheiro(i.precoUnitario),
        dinheiro(i.quantidade * i.precoUnitario),
        semAcento(i.observacao)
      ];
    });
  }

  function catalogo() {
    var d = window.CardapioStore.dados();
    var marca = dataHora();

    var linhas = [];

    d.categorias.forEach(function (cat) {
      (cat.itens || []).forEach(function (item) {
        linhas.push([
          textoCelula(cat.nome),
          /* O icone se repete em todas as linhas da categoria. E
             repeticao proposital: uma celula mesclada seria
             quebrada pelo getValues() do lado da leitura. */
          textoCelula(cat.icone),
          textoCelula(item.nome),
          dinheiro(item.preco),
          item.destaque ? 'Sim' : 'Nao',
          item.disponivel !== false ? 'Sim' : 'Nao',
          textoCelula(item.descricao),
          /* A URL fica crua, sem passar por textoCelula: ela e
             composta de "/" e "?" e "%", que a limpeza de texto
             apagaria e transformaria o link num caminho quebrado.
             So sai o que o Sheets interpretaria. */
          linkDeImagem(item.imagem),
          marca.data + ' ' + marca.hora
        ]);
      });
    });

    return { cabecalho: CABECALHO_CARDAPIO, linhas: linhas };
  }

  /* Campos que vão para a aba Config gravados como número, e os
     que vão como Sim/Nao. A mesma lista é usada na ida e na volta
     para as duas pontas concordarem sobre o tipo. */
  var CONFIG_NUMERO = ['taxaEntrega', 'pedidoMinimo'];
  var CONFIG_BOOLEANO = ['aberto', 'pedirNome', 'pedirEntrega'];

  /* O que o Sheets devolve numa célula editada à mão: quem digita
     "Nao" em vez de clicar na caixa de seleção, ou "8,50" em vez
     de 8.5, grava texto. */
  var NEGADOS = ['nao', 'n', 'f', 'false', '0', 'off'];

  function booleanoDe(valor, padrao) {
    if (valor === true) return true;
    if (valor === false) return false;

    var s = semAcento(valor === null || valor === undefined ? '' : valor).toLowerCase();
    if (!s) return padrao;

    return NEGADOS.indexOf(s) < 0;
  }

  function numeroDe(valor) {
    if (typeof valor === 'number') return isFinite(valor) && valor >= 0 ? valor : 0;

    /* Aceita o que o dono digita: "8,50", "R$ 8,50", "1.234,56". */
    var s = String(valor === null || valor === undefined ? '' : valor).replace(/[^\d.,-]/g, '');
    if (!s) return 0;

    var virgula = s.lastIndexOf(',');
    var ponto = s.lastIndexOf('.');

    if (virgula >= 0 && ponto >= 0) {
      s = virgula > ponto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (virgula >= 0) {
      s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    }

    var n = parseFloat(s);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  /* Aba Config: chave/valor, uma linha por campo da loja.
     Numeros e booleanos sao gravados com tipo de verdade, para o
     dono poder recalcular a aba sem brigar com texto. */
  function tabelaConfig() {
    var c = cfg();
    var marca = dataHora();

    var linhas = CAMPOS_CONFIG.map(function (chave) {
      var v = c[chave];

      if (CONFIG_NUMERO.indexOf(chave) >= 0) return [chave, dinheiro(v)];
      if (CONFIG_BOOLEANO.indexOf(chave) >= 0) return [chave, v === false ? 'Nao' : 'Sim'];

      return [chave, textoCelula(v)];
    });

    /* Uma linha de comentario no fim, com a data da publicacao.
       E o que o dono ve para saber se o cardapio do cliente esta
       atualizado sem precisar abrir a aba Registro. */
    linhas.push(['publicado_em', marca.data + ' ' + marca.hora]);

    return { cabecalho: CABECALHO_CONFIG, linhas: linhas };
  }

  /* ---------------------------------------------------------
     3. Envio
     --------------------------------------------------------- */
  function remember(texto) {
    try { localStorage.setItem(CHAVE_LOCAL, texto); } catch (e) { /* modo restrito */ }
  }

  function ultimoEnvio() {
    try { return localStorage.getItem(CHAVE_LOCAL) || ''; } catch (e) { return ''; }
  }

  /* Nao usamos async/await: o cardapio tambem roda em WebViews de
     Android antigas que engasgam com sintaxe moderna. */
  function postar(acao, abas) {
    var corpo = JSON.stringify({
      acao: acao,
      token: token(),
      origem: origem(),
      abas: abas
    });

    return fetch(base(), {
      method: 'POST',
      mode: 'no-cors',
      /* text/plain e um dos poucos tipos que nao exigem preflight.
         Com application/json o navegador perguntaria antes e a
         resposta seria barrada por falta de CORS. */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: corpo,
      /* O POST precisa sobreviver a aba fechando logo depois:
         o cliente manda o pedido e vai pro WhatsApp na mesma hora. */
      keepalive: true,
      redirect: 'follow'
    }).then(function () {
      /* Em no-cors o status sempre vem "opaque" e response.ok leria
         false. Checar aqui seria mentira: o dono acharia que falhou
         mesmo tendo gravado. So um erro de rede é sinal de problema. */
      remember(acao + ' · ' + new Date().toLocaleString('pt-BR'));
      return { ok: true };
    }, function (erro) {
      throw new Error(
        'Não foi possível alcançar o Apps Script. Confira a URL, se o Web App está publicado ' +
        'como "Anyone" e se o token é o mesmo dos dois lados. (' +
        (erro && erro.message ? erro.message : 'erro de rede') + ')'
      );
    });
  }

  function montarItens(brutos) {
    return brutos.map(function (i) {
      return {
        nome: semAcento(i.nome),
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        observacao: i.observacao || ''
      };
    });
  }

  function enviarPedido(pedido) {
    if (!configurada()) return Promise.resolve({ ignorado: true, motivo: 'sem-url' });

    var itens = montarItens(pedido.itens || []);
    if (!itens.length) return Promise.resolve({ ignorado: true, motivo: 'sem-itens' });

    var dh = dataHora();

    var p = {
      data: pedido.data || dh.data,
      hora: pedido.hora || dh.hora,
      pedido: pedido.pedido,
      cliente: pedido.cliente,
      tipo: pedido.tipo,
      endereco: pedido.endereco,
      pagamento: pedido.pagamento,
      observacoes: pedido.observacoes,
      subtotal: pedido.subtotal,
      taxa: pedido.taxa,
      total: pedido.total
    };

    return postar('pedido', [
      { nome: 'Pedidos', modo: 'append', cabecalho: CABECALHO_PEDIDOS, linhas: [linhaDoPedido(p, itens)] },
      { nome: 'Itens', modo: 'append', cabecalho: CABECALHO_ITENS, linhas: linhasDoPedido(itens, p) }
    ]);
  }

  /* ---------------------------------------------------------
     3b. Leitura do cardapio publicado (JSONP)
     ---------------------------------------------------------
     O Apps Script nao devolve cabecalho CORS, entao um fetch
     seria barrado. JSONP contorna: o navegador executa
     <script> de outra origem sem reclamar, e o script responde
     chamando uma funcao que criamos antes.

     Cuidado: o texto devolvido roda como codigo na nossa
     pagina. Por isso o nome da funcao nasce com prefixo fixo e
     um contador, nunca com nada vindo de fora.
     --------------------------------------------------------- */
  var contadorCallback = 0;

  function lerCardapio() {
    if (!configurada()) return Promise.resolve({ ignorado: true, motivo: 'sem-url' });

    /* O nome precisa usar SO [A-Za-z0-9_$]: o script recorta
       qualquer outro caractere do callback antes de montar a
       resposta, e um nome com "__" nos cantos chegaria la com um
       underscore a menos e a funcao nunca seria chamada. */
    var nome = 'cardapioLer' + (++contadorCallback);
    var chave = token();
    var url = comParams(
      'callback=' + nome + (chave ? '&token=' + encodeURIComponent(chave) : '')
    );

    return new Promise(function (resolve) {
      var script = document.createElement('script');
      /* A carga da pagina nao pode ficar esperando o Google.
         Sem este timeout, um Web App publicado errado prenderia
         o cardapio preso em "carregando" para sempre. */
      var relogio = setTimeout(function () {
        limpar();
        resolve({ ok: false, erro: 'Tempo esgotado ao buscar o cardápio na planilha.' });
      }, 8000);

      function limpar() {
        clearTimeout(relogio);
        if (script.parentNode) script.parentNode.removeChild(script);
        try { delete window[nome]; } catch (e) { window[nome] = undefined; }
      }

      window[nome] = function (resposta) {
        limpar();
        if (!resposta || resposta.ok !== true) {
          resolve({ ok: false, erro: (resposta && resposta.erro) || 'Resposta inesperada do script.' });
          return;
        }
        resolve({ ok: true, menu: resposta.menu, config: resposta.config });
      };

      script.onerror = function () {
        limpar();
        resolve({ ok: false, erro: 'Não foi possível carregar o script da planilha.' });
      };

      script.src = url;
      script.async = true;
      (document.head || document.body).appendChild(script);
    });
  }

  /* ---------------------------------------------------------
     3c. Aplicar o que veio da planilha
     --------------------------------------------------------- */

  /* A aba Config volta como texto quando o dono edita a celula a mao
     ("Nao", "8,50"). O Store espera booleano e numero de verdade:
     sem converter aqui, "Nao" viraria true, e o dono veria a loja
     pedindo entrega mesmo tendo desmarcado a caixa na planilha. */
  function aplicarConfig(destino, bruto) {
    CAMPOS_CONFIG.forEach(function (chave) {
      if (!Object.prototype.hasOwnProperty.call(bruto, chave)) return;

      var v = bruto[chave];

      if (CONFIG_BOOLEANO.indexOf(chave) >= 0) { destino[chave] = booleanoDe(v, true); return; }
      if (CONFIG_NUMERO.indexOf(chave) >= 0) { destino[chave] = numeroDe(v); return; }
      if (chave === 'whatsapp') { destino[chave] = String(v || '').replace(/\D/g, ''); return; }

      destino[chave] = String(v === null || v === undefined ? '' : v);
    });
  }

  function montarCategorias(menu) {
    return menu.map(function (cat) {
      return {
        nome: String(cat.nome || '').trim(),
        icone: String(cat.icone || '').trim(),
        itens: (cat.itens || []).map(function (item) {
          return {
            nome: String(item.nome || '').trim(),
            preco: item.preco,
            descricao: String(item.descricao || ''),
            imagem: String(item.imagem || ''),
            destaque: item.destaque === true,
            disponivel: item.disponivel !== false
          };
        })
      };
    }).filter(function (cat) {
      return cat.nome && cat.itens.length;
    });
  }

  /* Traduz a resposta do script em dois "patches". Separate de
     proposito: quem decide se pode sobrescrever o que esta na
     tela precisa olhar o patch antes de aplicá-lo. */
  function montarPatches(resposta) {
    var menu = resposta && Array.isArray(resposta.menu) ? resposta.menu : null;
    var config = resposta && resposta.config && typeof resposta.config === 'object'
      ? resposta.config
      : null;

    return {
      config: config,
      categorias: menu && menu.length ? montarCategorias(menu) : null
    };
  }

  function temConteudo(patches) {
    return !!(patches.config || patches.categorias);
  }

  function aplicarPatches(d, patches) {
    if (patches.config) aplicarConfig(d.config, patches.config);
    if (patches.categorias) d.categorias = patches.categorias;
  }

  function contaItens(categorias) {
    var total = 0;
    categorias.forEach(function (c) { total += (c.itens || []).length; });
    return total;
  }

  /**
   * O que a planilha trocaria, sem gravar nada.
   * O painel usa isto para não sobrescrever edição feita à mão:
   * primeiro pergunta, depois aplica.
   */
  function comparar(resposta) {
    var Store = window.CardapioStore;
    if (!Store) return { muda: false, categorias: 0, itens: 0 };

    var patches = montarPatches(resposta);
    if (!temConteudo(patches)) return { muda: false, categorias: 0, itens: 0 };

    /* Uma cópia profunda: aplicar no dicionário vivo mudaria o
       Store antes da hora, e Store.validar só normaliza. */
    var rascunho = Store.clone(Store.dados());

    aplicarPatches(rascunho, patches);

    /* Passa pela mesma normalização que o Store faria ao gravar.
       Sem isso a comparação acusaria diferença em campo que a
       normalização preenche depois (id gerado, preço zerado,
       item sem imagem virando ''), e o aviso de "não publicado"
       nunca se apagaria. */
    var depois = Store.validar(rascunho).data;

    return {
      muda: impressaoDe(depois) !== impressaoDe(Store.dados()),
      categorias: depois.categorias.length,
      itens: contaItens(depois.categorias)
    };
  }

  /**
   * Troca o cardápio em memória pelo que está publicado na planilha.
   * Devolve quantas categorias e itens entraram, para a página
   * avisar se vale conferir a aba.
   *
   * A planilha é a fonte da verdade, mas menu vazio ou config
   * ausente não apagam o que já está aqui: planilha recém-criada
   * sem publicação é o estado normal logo depois de configurar a
   * URL, e um cardápio vazio na tela seria pior que o anterior.
   */
  function aplicarCardapio(resposta) {
    var Store = window.CardapioStore;
    if (!Store || !resposta) return { alterados: 0, categorias: 0, itens: 0 };

    var patches = montarPatches(resposta);
    if (!temConteudo(patches)) return { alterados: 0, categorias: 0, itens: 0 };

    var antes = Store.serializar();

    Store.alterar(function (d) {
      aplicarPatches(d, patches);
    });

    var d = Store.dados();

    return {
      alterados: Store.serializar() !== antes ? 1 : 0,
      categorias: d.categorias.length,
      itens: contaItens(d.categorias)
    };
  }

  /* ---------------------------------------------------------
     3d. O que esta publicado x o que esta na tela
     ---------------------------------------------------------
     Com a planilha como fonte da verdade, editar no painel sem
     publicar deixa o cliente vendo a versao antiga — e sem nenhum
     aviso, porque o painel tem cara de salvo. A comparacao ignora
     planilhaUrl e planilhaToken de proposito: eles nunca vao para
     a planilha, e incluir-los faria o aviso nunca se resolver. */
  var CHAVE_PUBLICADO = 'cardapio:publicado:v1';

  function impressaoDe(d) {
    var config = {};

    CAMPOS_CONFIG.forEach(function (chave) {
      config[chave] = d && d.config ? d.config[chave] : undefined;
    });

    return JSON.stringify({ config: config, categorias: d ? d.categorias : [] });
  }

  function impressao() {
    var Store = window.CardapioStore;
    if (!Store) return '';
    return impressaoDe(Store.dados());
  }

  function marcarPublicado() {
    var texto = impressao();
    try { localStorage.setItem(CHAVE_PUBLICADO, texto); } catch (e) { /* modo restrito */ }
    return texto;
  }

  function alteracoesPendentes() {
    var guardado = null;
    try { guardado = localStorage.getItem(CHAVE_PUBLICADO); } catch (e) { return false; }

    /* Sem registro do que foi publicado, nao da para afirmar que
       existe mudanca. O painel esta mostrando o que a planilha
       devolveu, entao o certo e dizer que esta em dia. */
    if (!guardado) return false;

    return guardado !== impressao();
  }

  function enviarCardapio() {
    if (!configurada()) return Promise.resolve({ ignorado: true, motivo: 'sem-url' });

    var cat = catalogo();
    if (!cat.linhas.length) {
      return Promise.reject(new Error('O cardápio está vazio: nada a enviar.'));
    }

    var conf = tabelaConfig();

    /* Um POST so com as duas abas: se a rede falhar no meio, o
       script processa na ordem e o cardapio fica consistente com
       a configuracao. */
    return postar('cardapio', [
      { nome: 'Cardápio', modo: 'replace', cabecalho: cat.cabecalho, linhas: cat.linhas },
      { nome: 'Config', modo: 'replace', cabecalho: conf.cabecalho, linhas: conf.linhas }
    ]).then(function (r) {
      r.itens = cat.linhas.length;
      marcarPublicado();
      return r;
    });
  }

  window.CardapioPlanilha = {
    configurada: configurada,
    enviarPedido: enviarPedido,
    enviarCardapio: enviarCardapio,
    lerCardapio: lerCardapio,
    aplicarCardapio: aplicarCardapio,
    comparar: comparar,
    pendentes: alteracoesPendentes,
    marcarPublicado: marcarPublicado,
    catalogo: catalogo,
    tabelaConfig: tabelaConfig,
    ultimoEnvio: ultimoEnvio,
    cabecalhos: {
      pedidos: CABECALHO_PEDIDOS,
      itens: CABECALHO_ITENS,
      cardapio: CABECALHO_CARDAPIO,
      config: CABECALHO_CONFIG
    },
    camposConfig: CAMPOS_CONFIG
  };
})();