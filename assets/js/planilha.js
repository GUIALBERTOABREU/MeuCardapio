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
    'Categoria', 'Item', 'Preco', 'Destaque', 'Disponivel', 'Descricao', 'Atualizado'
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
          semAcento(cat.nome),
          semAcento(item.nome),
          dinheiro(item.preco),
          item.destaque ? 'Sim' : 'Nao',
          item.disponivel !== false ? 'Sim' : 'Nao',
          /* Descricao costuma ter virgula e ponto: o Sheets abriria
             aspas e comeria o resto da linha. */
          semAcento(item.descricao).replace(/"/g, ''),
          marca.data + ' ' + marca.hora
        ]);
      });
    });

    return { cabecalho: CABECALHO_CARDAPIO, linhas: linhas };
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
    var c = cfg();

    var corpo = JSON.stringify({
      acao: acao,
      token: c.planilhaToken || '',
      origem: origem(),
      abas: abas
    });

    return fetch(c.planilhaUrl, {
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

  function enviarCardapio() {
    if (!configurada()) return Promise.resolve({ ignorado: true, motivo: 'sem-url' });

    var cat = catalogo();
    if (!cat.linhas.length) {
      return Promise.reject(new Error('O cardápio está vazio: nada a enviar.'));
    }

    return postar('cardapio', [
      { nome: 'Cardápio', modo: 'replace', cabecalho: cat.cabecalho, linhas: cat.linhas }
    ]).then(function (r) {
      r.itens = cat.linhas.length;
      return r;
    });
  }

  window.CardapioPlanilha = {
    configurada: configurada,
    enviarPedido: enviarPedido,
    enviarCardapio: enviarCardapio,
    catalogo: catalogo,
    ultimoEnvio: ultimoEnvio,
    cabecalhos: {
      pedidos: CABECALHO_PEDIDOS,
      itens: CABECALHO_ITENS,
      cardapio: CABECALHO_CARDAPIO
    }
  };
})();