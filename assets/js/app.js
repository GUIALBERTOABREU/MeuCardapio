/* =============================================================
   app.js  —  cardapio do cliente: lista, busca, carrinho,
   finalizacao e envio do pedido pelo WhatsApp.
   ============================================================= */
(function () {
  'use strict';

  var Store = window.CardapioStore;

  var CHAVE_CARRINHO = 'cardapio:carrinho:v1';
  var CHAVE_CLIENTE = 'cardapio:cliente:v1';

  var el = {};
  var carrinho = [];   /* [{ id, qtd, obs }] */
  var cliente = {};    /* dados do cliente para o pedido */
  var busca = '';
  var modoCheckout = false;

  /* =========================================================
     Utilitarios
     ========================================================= */
  function moeda(valor) {
    return (Store.dados().config.simboloMoeda || 'R$') + ' ' + numero(valor);
  }

  function numero(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function esc(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function $(sel) { return document.querySelector(sel); }

  function todosItens() {
    var itens = [];
    Store.dados().categorias.forEach(function (cat) {
      (cat.itens || []).forEach(function (item) {
        itens.push({ item: item, categoria: cat });
      });
    });
    return itens;
  }

  function acharItem(id) {
    var achado = null;
    Store.dados().categorias.forEach(function (cat) {
      (cat.itens || []).forEach(function (item) {
        if (item.id === id) achado = { item: item, categoria: cat };
      });
    });
    return achado;
  }

  function emojiDoItem(item, categoria) {
    if (item.imagem) return '<img src="' + esc(item.imagem) + '" alt="" loading="lazy">';
    return esc((categoria && categoria.icone) || '🍽️');
  }

  /* ---------- toasts ---------- */
  var MAX_TOASTS = 3;

  function avisar(mensagem, tipo) {
    /* Agrupa repetidos e limita a pilha: clicar "+" varias vezes
       seguidas nao deve empilhar dezenas de avisos. */
    var anteriores = el.toasts.querySelectorAll('.toast');
    for (var i = 0; i < anteriores.length; i++) {
      if (anteriores[i].textContent === mensagem) return;
    }
    while (el.toasts.children.length >= MAX_TOASTS) {
      el.toasts.firstElementChild.remove();
    }

    var t = document.createElement('div');
    t.className = 'toast' + (tipo ? ' toast-' + tipo : '');
    t.textContent = mensagem;
    el.toasts.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s, transform .25s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(function () { t.remove(); }, 260);
    }, 2400);
  }

  /* =========================================================
     Persistencia local do carrinho
     ========================================================= */
  function salvarCarrinho() {
    try { localStorage.setItem(CHAVE_CARRINHO, JSON.stringify({ itens: carrinho, cliente: cliente })); } catch (e) { /* ignora */ }
  }

  function carregarCarrinho() {
    try {
      var bruto = localStorage.getItem(CHAVE_CARRINHO);
      if (!bruto) return;
      var dados = JSON.parse(bruto);
      if (Array.isArray(dados.itens)) {
        carrinho = dados.itens.filter(function (l) { return l && l.id; }).map(function (l) {
          return { id: String(l.id), qtd: Math.max(1, parseInt(l.qtd, 10) || 1), obs: l.obs || '' };
        });
      }
      if (dados.cliente && typeof dados.cliente === 'object') cliente = dados.cliente;
    } catch (e) { /* ignora */ }
  }

  /* Remove do carrinho o que nao existe mais no cardapio
     (item deletado no painel, ou que virou indisponivel). */
  function podarCarrinho() {
    var antes = carrinho.length;
    carrinho = carrinho.filter(function (l) {
      var achado = acharItem(l.id);
      return achado && achado.item.disponivel !== false;
    });
    if (carrinho.length !== antes) salvarCarrinho();
    return antes - carrinho.length;
  }

  /* =========================================================
     Cabecalho
     ========================================================= */
  function aplicarCor() {
    var cfg = Store.dados().config;
    /* Store calcula os tom derivado da cor escolhida pelo dono,
       para o texto branco sobre a cor continuar legivel. */
    Store.aplicarCor(cfg.corPrimaria);
    document.title = cfg.nome + ' — Cardápio Digital';
  }

  function renderCabecalho() {
    var cfg = Store.dados().config;

    el.nome.textContent = cfg.nome;
    el.sub.textContent = cfg.descricao || '';
    el.logo.textContent = '';
    el.logo.innerHTML = '<span style="font-size:1.4rem">🍔</span>';
    el.rodapeNome.textContent = cfg.nome;

    el.status.hidden = false;
    el.status.className = 'selo ' + (cfg.aberto ? 'selo-aberto' : 'selo-fechado');
    el.status.textContent = cfg.aberto ? 'Aberto' : 'Fechado';

    el.avisoFechado.hidden = cfg.aberto;
    el.avisoFechadoTexto.textContent = cfg.mensagemFechado || '';
  }

  /* =========================================================
     Abas de categorias
     ========================================================= */
  function renderAbas() {
    var cats = Store.dados().categorias;
    var lista = busca
      ? categoriasComResultado()
      : cats;

    el.abas.innerHTML = '';

    if (busca) {
      var chipTodos = document.createElement('button');
      chipTodos.type = 'button';
      chipTodos.className = 'aba';
      chipTodos.setAttribute('aria-current', 'true');
      chipTodos.textContent = '🔎 Resultados (' + lista.reduce(function (n, c) { return n + c.itens.length; }, 0) + ')';
      el.abas.appendChild(chipTodos);
      return;
    }

    lista.forEach(function (cat, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'aba';
      b.textContent = (cat.icone ? cat.icone + ' ' : '') + cat.nome;
      if (i === 0) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', function () {
        var alvo = document.getElementById('cat-' + cat.id);
        if (alvo) {
          var y = alvo.getBoundingClientRect().top + window.pageYOffset - 150;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      });
      el.abas.appendChild(b);
    });
  }

  /* Tira acentos para a busca: "porcoes" acha "Porções". */
  function semAcento(t) {
    return String(t || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function categoriasComResultado() {
    var termo = semAcento(busca);
    if (!termo) return [];

    return Store.dados().categorias
      .map(function (cat) {
        /* o nome da categoria tambem conta como resultado */
        var achouCategoria = semAcento(cat.nome).indexOf(termo) >= 0;

        return {
          id: cat.id,
          nome: cat.nome,
          icone: cat.icone,
          itens: (cat.itens || []).filter(function (item) {
            return item.disponivel !== false && (achouCategoria ||
              semAcento(item.nome).indexOf(termo) >= 0 ||
              semAcento(item.descricao).indexOf(termo) >= 0);
          })
        };
      })
      .filter(function (cat) { return cat.itens.length > 0; });
  }

  /* =========================================================
     Lista de itens
     ========================================================= */
  function renderLista() {
    var cfg = Store.dados().config;
    var html = '';

    if (busca) {
      var resultados = categoriasComResultado();
      var total = resultados.reduce(function (n, c) { return n + c.itens.length; }, 0);

      if (!total) {
        el.lista.innerHTML =
          '<div class="vazio"><span class="vazio-icone">🔍</span>' +
          '<p>Nada encontrado para "<strong>' + esc(busca) + '</strong>".</p>' +
          '<button type="button" class="btn btn-contorno btn-sm" data-limpar-busca>Limpar busca</button></div>';
        return;
      }

      resultados.forEach(function (cat) {
        html += '<section class="secao"><div class="secao-topo">' +
          '<h2 class="secao-titulo">' + esc(cat.icone || '🍽️') + ' ' + esc(cat.nome) + '</h2>' +
          '<span class="secao-contagem">' + cat.itens.length + ' encontrado(s)</span>' +
          '</div><div class="grade">' + cartoes(cat.itens, cat, cfg) + '</div></section>';
      });

      el.lista.innerHTML = html;
      return;
    }

    var categorias = Store.dados().categorias;

    if (!categorias.length) {
      el.lista.innerHTML =
        '<div class="vazio"><span class="vazio-icone">📋</span>' +
        '<p>O cardápio ainda não tem itens.</p>' +
        '<a class="btn btn-primario btn-sm" href="admin.html">Cadastrar itens</a></div>';
      return;
    }

    /* Destaques primeiro */
    var destaques = [];
    categorias.forEach(function (cat) {
      (cat.itens || []).forEach(function (item) {
        if (item.destaque && item.disponivel !== false) destaques.push({ item: item, cat: cat });
      });
    });

    if (destaques.length) {
      html += '<section class="secao"><div class="secao-topo">' +
        '<h2 class="secao-titulo">⭐ Destaques</h2>' +
        '<span class="secao-contagem">os mais pedidos</span>' +
        '</div><div class="grade">' +
        destaques.map(function (d) { return cartao(d.item, d.cat, cfg); }).join('') +
        '</div></section>';
    }

    categorias.forEach(function (cat) {
      var itens = (cat.itens || []).filter(function (i) { return i.disponivel !== false; });
      if (!itens.length) return;

      html += '<section class="secao" id="cat-' + esc(cat.id) + '">' +
        '<div class="secao-topo">' +
        '<h2 class="secao-titulo">' + esc(cat.icone || '🍽️') + ' ' + esc(cat.nome) + '</h2>' +
        '<span class="secao-contagem">' + itens.length + ' item(ns)</span>' +
        '</div><div class="grade">' + cartoes(itens, cat, cfg) + '</div></section>';
    });

    el.lista.innerHTML = html || '<div class="vazio"><span class="vazio-icone">📋</span><p>Nenhum item disponível no momento.</p></div>';
  }

  function cartoes(itens, cat, cfg) {
    return itens.map(function (item) { return cartao(item, cat, cfg); }).join('');
  }

  function cartao(item, cat, cfg) {
    var noCarrinho = quantidade(item.id);

    return '' +
    '<article class="cartao' + (noCarrinho ? '' : '') + '">' +
      '<div class="cartao-foto">' + emojiDoItem(item, cat) +
        (item.destaque ? '<span class="selo-destaque">Destaque</span>' : '') +
        (item.disponivel === false ? '<span class="selo-esgotado">Indisponível</span>' : '') +
      '</div>' +
      '<div class="cartao-corpo">' +
        '<h3 class="cartao-nome">' + esc(item.nome) + '</h3>' +
        (item.descricao ? '<p class="cartao-desc">' + esc(item.descricao) + '</p>' : '') +
        '<div class="cartao-rodape">' +
          '<span class="preco">' + moeda(item.preco) + '</span>' +
          (noCarrinho > 0 ? contador(item.id, noCarrinho) : botaoAdicionar(item)) +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function botaoAdicionar(item) {
    if (item.disponivel === false || !Store.dados().config.aberto) {
      return '<button type="button" class="btn btn-sm btn-contorno" disabled>Indisponível</button>';
    }
    return '<button type="button" class="btn btn-sm btn-primario" data-add="' + esc(item.id) + '">+ Adicionar</button>';
  }

  function contador(id, qtd) {
    return '' +
    '<span class="quantidade">' +
      '<button type="button" data-dec="' + esc(id) + '" aria-label="Diminuir quantidade">−</button>' +
      '<output aria-label="Quantidade">' + qtd + '</output>' +
      '<button type="button" data-inc="' + esc(id) + '" aria-label="Aumentar quantidade">+</button>' +
    '</span>';
  }

  /* =========================================================
     Carrinho
     ========================================================= */
  function quantidade(id) {
    var linha = carrinho.filter(function (l) { return l.id === id; })[0];
    return linha ? linha.qtd : 0;
  }

  function alterarQtd(id, delta) {
    var nova = quantidade(id) + delta;
    if (nova <= 0) {
      carrinho = carrinho.filter(function (l) { return l.id !== id; });
    } else {
      var achada = carrinho.filter(function (l) { return l.id === id; })[0];
      if (achada) achada.qtd = Math.min(99, nova);
      else carrinho.push({ id: id, qtd: 1, obs: '' });
    }
    salvarCarrinho();
    render();
    if (modoCheckout) renderModal();
  }

  function addItem(id) {
    var achado = acharItem(id);
    if (!achado || achado.item.disponivel === false) return;
    alterarQtd(id, 1);
    avisar(achado.item.nome + ' adicionado 🛒', 'ok');
  }

  function subtotal() {
    return carrinho.reduce(function (soma, linha) {
      var achado = acharItem(linha.id);
      return soma + (achado ? achado.item.preco * linha.qtd : 0);
    }, 0);
  }

  function totalItens() {
    return carrinho.reduce(function (n, l) { return n + l.qtd; }, 0);
  }

  /* Retirada no local nao paga taxa de entrega. */
  function ehRetirada() {
    return cliente.tipo === 'retirada';
  }

  function taxaAplicada() {
    return ehRetirada() ? 0 : (Store.dados().config.taxaEntrega || 0);
  }

  function totalGeral() {
    return subtotal() + taxaAplicada();
  }

  function renderBotaoCarrinho() {
    var qtd = totalItens();
    el.btnCarrinho.classList.toggle('oculto', qtd === 0);
    el.btnCarrinho.setAttribute('aria-label', 'Abrir pedido com ' + qtd + ' item(ns), total ' + moeda(totalGeral()));
    el.cfTotal.textContent = moeda(totalGeral());
    el.cfQtd.textContent = qtd;
    var partes = qtd + ' item(ns)';
    if (taxaAplicada() > 0) partes += ' + ' + moeda(taxaAplicada()) + ' entrega';
    el.cfSub.textContent = partes;
  }

  /* =========================================================
     Modal: carrinho e checkout
     ========================================================= */
  function abrirModal(titulo, corpo, rodape) {
    el.modalTitulo.textContent = titulo;
    el.modalCorpo.innerHTML = corpo;
    el.modalRodape.innerHTML = rodape;
    el.overlay.classList.remove('oculto');
    document.body.classList.add('travado');
    var foco = el.modalCorpo.querySelector('input, textarea, button');
    if (foco) setTimeout(function () { foco.focus(); }, 60);
  }

  function fecharModal() {
    el.overlay.classList.add('oculto');
    document.body.classList.remove('travado');
    modoCheckout = false;
  }

  function renderModal() {
    if (modoCheckout) return renderCheckout();
    renderCarrinho();
  }

  function renderCarrinho() {
    modoCheckout = false;

    if (!carrinho.length) {
      abrirModal('Seu pedido',
        '<div class="vazio"><span class="vazio-icone">🛒</span><p>Seu pedido está vazio.</p>' +
        '<p class="dica">Toque em “+ Adicionar” nos itens que quiser.</p></div>',
        '<button type="button" class="btn btn-contorno btn-bloco" data-fechar>Continuar comprando</button>');
      return;
    }

    var cfg = Store.dados().config;
    var corpo = '';

    carrinho.forEach(function (linha) {
      var achado = acharItem(linha.id);
      if (!achado) return;
      var item = achado.item;

      corpo += '' +
      '<div class="linha">' +
        '<div class="linha-emoji">' + emojiDoItem(item, achado.categoria) + '</div>' +
        '<div class="linha-info">' +
          '<p class="linha-nome">' + esc(item.nome) + '</p>' +
          '<p class="linha-preco-unit">' + moeda(item.preco) + ' cada</p>' +
          '<div class="linha-acoes">' + contador(item.id, linha.qtd) +
            '<span class="linha-total">' + moeda(item.preco * linha.qtd) + '</span>' +
          '</div>' +
          '<input type="text" class="obs-item" placeholder="Observação (ex.: sem cebola)" ' +
            'value="' + esc(linha.obs) + '" data-obs="' + esc(item.id) + '" maxlength="140">' +
        '</div>' +
      '</div>';
    });

    corpo += '<div class="totais" style="margin-top:16px">' +
      '<div><span>Subtotal (' + totalItens() + ' itens)</span><span>' + moeda(subtotal()) + '</span></div>' +
      (taxaAplicada() > 0 ? '<div><span>Taxa de entrega</span><span>' + moeda(taxaAplicada()) + '</span></div>' : '') +
      '<div class="total-final"><span>Total</span><span>' + moeda(totalGeral()) + '</span></div>' +
      '</div>';

    var faltaMinimo = faltaPedidoMinimo();

    if (faltaMinimo > 0) {
      corpo += '<div class="minimo-alerta" style="margin-top:14px">' +
        'Pedido mínimo de ' + moeda(Store.dados().config.pedidoMinimo) + '. ' +
        'Falta ' + moeda(faltaMinimo) + ' para finalizar.</div>';
    }

    abrirModal('Seu pedido', corpo,
      '<button type="button" class="btn btn-primario btn-bloco" data-checkout' +
        (faltaMinimo > 0 ? ' disabled' : '') + '>Finalizar pedido no WhatsApp</button>' +
      '<button type="button" class="btn btn-contorno btn-bloco" data-fechar>Continuar comprando</button>');
  }

  /* Quanto falta para bater o pedido minimo (0 se nao houver). */
  function faltaPedidoMinimo() {
    var minimo = Store.dados().config.pedidoMinimo || 0;
    if (minimo <= 0) return 0;
    return Math.max(0, minimo - subtotal());
  }

  function renderCheckout() {
    modoCheckout = true;
    var cfg = Store.dados().config;

    var corpo = '' +
      '<div class="empilha">' +
        (cfg.pedirNome !== false ?
        '<div class="campo"><label for="coNome">Seu nome</label>' +
        '<input type="text" id="coNome" placeholder="Como podemos te chamar?" value="' + esc(cliente.nome || '') + '"></div>' : '') +

        '<div class="campo"><span>Entrega ou retirada?</span>' +
        '<div class="opcoes">' +
          '<label class="opcao"><input type="radio" name="coTipo" value="entrega"' + (cliente.tipo === 'retirada' ? '' : ' checked') + '><span>🛵 Entrega</span></label>' +
          '<label class="opcao"><input type="radio" name="coTipo" value="retirada"' + (cliente.tipo === 'retirada' ? ' checked' : '') + '><span>🏠 Retirada</span></label>' +
        '</div></div>' +

        '<div class="campo" id="coEnderecoBox"><label for="coEndereco">Endereço de entrega</label>' +
        '<input type="text" id="coEndereco" placeholder="Rua, número, bairro, complemento" value="' + esc(cliente.endereco || '') + '"></div>' +

        '<div class="campo"><label for="coPagamento">Forma de pagamento</label>' +
        '<input type="text" id="coPagamento" placeholder="Ex.: Pix, dinheiro, cartão" value="' + esc(cliente.pagamento || '') + '"></div>' +

        '<div class="campo"><label for="coObs">Observações gerais</label>' +
        '<textarea id="coObs" placeholder="Ex.: tocar o interfone, sem cebola no lanche…" maxlength="300">' + esc(cliente.obs || '') + '</textarea></div>' +

        '<div class="totais" id="coTotais" style="padding:14px;background:var(--superficie-2);border-radius:var(--raio-sm);border:1px solid var(--borda)"></div>' +

        '<details><summary style="cursor:pointer;font-weight:700;font-size:.85rem;color:var(--texto-suave)">Ver prévia da mensagem</summary>' +
        '<div class="previa" id="coPrevia" style="margin-top:10px"></div></details>' +
      '</div>';

    abrirModal('Finalizar pedido', corpo,
      '<button type="button" class="btn btn-Whatsapp btn-bloco" data-enviar>Enviar pedido no WhatsApp</button>' +
      '<button type="button" class="btn btn-contorno btn-bloco" data-voltar-carrinho>← Voltar ao pedido</button>');

    atualizarPrevia();
  }

  function coletarCliente() {
    var cfg = Store.dados().config;
    var tipoEl = el.modalCorpo.querySelector('input[name="coTipo"]:checked');
    var tipo = tipoEl ? tipoEl.value : 'entrega';

    if (cfg.pedirNome !== false) cliente.nome = (el.modalCorpo.querySelector('#coNome') || {}).value || '';
    cliente.tipo = tipo;
    cliente.endereco = cfg.pedirEntrega !== false ? ((el.modalCorpo.querySelector('#coEndereco') || {}).value || '') : '';
    cliente.pagamento = (el.modalCorpo.querySelector('#coPagamento') || {}).value || '';
    cliente.obs = (el.modalCorpo.querySelector('#coObs') || {}).value || '';

    salvarCarrinho();
  }

  /* ---------- mensagem do WhatsApp ---------- */
  function numeroPedido() {
    var agora = new Date();
    var dia = String(agora.getDate()).padStart(2, '0') + String(agora.getMonth() + 1).padStart(2, '0');
    var sufixo = String(Math.floor(Math.random() * 900) + 100);
    return dia + '-' + sufixo;
  }

  function montarMensagem() {
    var cfg = Store.dados().config;
    var linhas = [];

    linhas.push('*' + cfg.nome + ' — PEDIDO*');
    linhas.push('Pedido #' + numeroPedido());

    if (cliente.nome) linhas.push('*Cliente:* ' + cliente.nome);
    linhas.push('');

    linhas.push('*Itens*');
    carrinho.forEach(function (linha, i) {
      var achado = acharItem(linha.id);
      if (!achado) return;
      linhas.push('');
      linhas.push((i + 1) + '. ' + linha.qtd + 'x ' + achado.item.nome + ' — ' + moeda(achado.item.preco * linha.qtd));
      if (linha.obs) linhas.push('   _obs: ' + linha.obs + '_');
    });

    linhas.push('');
    linhas.push('*Resumo*');
    linhas.push('Subtotal: ' + moeda(subtotal()));
    if (taxaAplicada() > 0) linhas.push('Taxa de entrega: ' + moeda(taxaAplicada()));
    linhas.push('*TOTAL: ' + moeda(totalGeral()) + '*');

    if (cliente.tipo) linhas.push('\n*Entrega:* ' + (cliente.tipo === 'retirada' ? 'Retirada no local' : 'Entrega em ' + (cliente.endereco || 'a combinar')));
    if (cliente.pagamento) linhas.push('*Pagamento:* ' + cliente.pagamento);
    if (cliente.obs) linhas.push('\n*Observações:* ' + cliente.obs);

    linhas.push('\n' + (cfg.mensagemAbertura || 'Pedido feito pelo cardápio digital.'));

    return linhas.join('\n');
  }

  function atualizarPrevia() {
    var previa = el.modalCorpo.querySelector('#coPrevia');
    if (previa) previa.textContent = montarMensagem();

    /* resumo do total, que muda se o cliente trocar para retirada */
    var totais = el.modalCorpo.querySelector('#coTotais');
    if (totais) {
      totais.innerHTML =
        '<div><span>Subtotal (' + totalItens() + ' itens)</span><span>' + moeda(subtotal()) + '</span></div>' +
        (taxaAplicada() > 0 ? '<div><span>Taxa de entrega</span><span>' + moeda(taxaAplicada()) + '</span></div>' : '') +
        '<div class="total-final"><span>Total</span><span>' + moeda(totalGeral()) + '</span></div>';
    }
  }

  function enviarWhatsApp() {
    coletarCliente();

    var cfg = Store.dados().config;

    if (faltaPedidoMinimo() > 0) {
      avisar('O pedido ainda não atingiu o mínimo.', 'erro');
      return;
    }
    if (!cfg.aberto) {
      avisar('A lanchonete está fechada no momento.', 'erro');
      return;
    }
    if (!cfg.whatsapp) {
      avisar('O dono ainda não cadastrou o WhatsApp.', 'erro');
      return;
    }

    var texto = encodeURIComponent(montarMensagem());
    var link = 'https://wa.me/' + cfg.whatsapp + '?text=' + texto;

    window.open(link, '_blank', 'noopener');

    avisar('Abrindo o WhatsApp… ✅', 'ok');
    registrarPlanilha();
    setTimeout(function () {
      carrinho = [];
      cliente = {};
      salvarCarrinho();
      fecharModal();
      render();
    }, 700);
  }

  /* ---------- planilha (Google Sheets) ----------
     Dispara depois de abrir o WhatsApp e sem esperar a resposta:
     o cliente não pode ficar olhando a tela por causa da planilha,
     e o POST em no-cors não devolve nada legível mesmo. */
  function registrarPlanilha() {
    var P = window.CardapioPlanilha;
    if (!P || !P.configurada()) return;

    var agora = new Date();
    var cfg = Store.dados().config;

    var itens = carrinho.map(function (linha) {
      var achado = acharItem(linha.id);
      if (!achado) return null;
      return {
        nome: achado.item.nome,
        quantidade: linha.qtd,
        precoUnitario: achado.item.preco,
        observacao: linha.obs || ''
      };
    }).filter(Boolean);

    if (!itens.length) return;

    P.enviarPedido({
      data: agora.toLocaleDateString('pt-BR'),
      hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      pedido: numeroPedido(),
      cliente: cliente.nome || '',
      tipo: cliente.tipo || 'entrega',
      endereco: cliente.endereco || '',
      pagamento: cliente.pagamento || '',
      observacoes: cliente.obs || '',
      itens: itens,
      subtotal: subtotal(),
      taxa: taxaAplicada(),
      total: totalGeral(),
      loja: cfg.nome
    }).then(function (r) {
      if (r && r.ignorado) return;
      avisar('Pedido salvo na planilha ✅', 'ok');
    }, function (erro) {
      /* O WhatsApp ja foi aberto com o pedido inteiro, entao falhar
         aqui e so avisar -- nao pode travar o cliente esperando. */
      avisar('Não consegui salvar na planilha, mas seu pedido foi enviado.', 'erro');
      if (window.console && console.warn) console.warn('[cardapio] planilha:', erro && erro.message);
    });
  }

  /* =========================================================
     Render geral
     ========================================================= */
  function render() {
    aplicarCor();
    renderCabecalho();
    renderAbas();
    renderLista();
    renderBotaoCarrinho();
  }

  /* =========================================================
     Eventos
     ========================================================= */
  function ligarEventos() {
    /* busca */
    el.busca.addEventListener('input', function () {
      busca = this.value.trim();
      el.limpar.hidden = !busca;
      renderAbas();
      renderLista();
    });

    el.limpar.addEventListener('click', function () {
      el.busca.value = '';
      busca = '';
      this.hidden = true;
      renderAbas();
      renderLista();
      el.busca.focus();
    });

    /* clique delegado na lista (adicionar / limpar busca) */
    el.lista.addEventListener('click', function (ev) {
      var alvo = ev.target.closest('[data-add], [data-limpar-busca]');
      if (!alvo) return;

      if (alvo.hasAttribute('data-limpar-busca')) {
        el.busca.value = ''; busca = ''; el.limpar.hidden = true;
        renderAbas(); renderLista();
        return;
      }
      if (alvo.hasAttribute('data-add')) addItem(alvo.getAttribute('data-add'));
    });

    /* clique delegado no carrinho flutuante e no modal */
    document.addEventListener('click', function (ev) {
      if (ev.target.closest('#botaoCarrinho')) { renderCarrinho(); return; }
      if (ev.target.closest('[data-fechar]') || ev.target.closest('#modalFechar')) { fecharModal(); return; }
      if (ev.target.closest('[data-checkout]')) { renderCheckout(); return; }
      if (ev.target.closest('[data-voltar-carrinho]')) { renderCarrinho(); return; }
      if (ev.target.closest('[data-enviar]')) { enviarWhatsApp(); return; }

      var inc = ev.target.closest('[data-inc]');
      if (inc) { alterarQtd(inc.getAttribute('data-inc'), 1); return; }
      var dec = ev.target.closest('[data-dec]');
      if (dec) { alterarQtd(dec.getAttribute('data-dec'), -1); return; }
    });

    /* observações por item */
    el.modalCorpo.addEventListener('input', function (ev) {
      var id = ev.target.getAttribute && ev.target.getAttribute('data-obs');
      if (!id) return;
      carrinho.forEach(function (l) { if (l.id === id) l.obs = ev.target.value; });
      salvarCarrinho();
    });

    /* preview no checkout */
    el.modalCorpo.addEventListener('input', function (ev) {
      if (ev.target.id === 'coNome' || ev.target.id === 'coEndereco' ||
          ev.target.id === 'coPagamento' || ev.target.id === 'coObs' ||
          ev.target.name === 'coTipo') {
        coletarCliente();
        atualizarPrevia();
      }
    });

    /* mostra/esconde endereço conforme entrega ou retirada */
    el.modalCorpo.addEventListener('change', function (ev) {
      if (ev.target.name === 'coTipo') {
        var box = el.modalCorpo.querySelector('#coEnderecoBox');
        if (box) box.classList.toggle('oculto', ev.target.value === 'retirada');
        coletarCliente();
        atualizarPrevia();
        renderBotaoCarrinho(); /* retirada tira a taxa de entrega */
      }
    });

    /* fecha modal clicando fora */
    el.overlay.addEventListener('mousedown', function (ev) {
      if (ev.target === el.overlay) fecharModal();
    });

    /* teclado */
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !el.overlay.classList.contains('oculto')) fecharModal();
    });

    /* baixa o JSON direto do cardápio */
    $('#linkBaixarJson').addEventListener('click', function (ev) {
      ev.preventDefault();
      Store.baixar('cardapio.json', Store.serializar());
      avisar('cardapio.json baixado 📄', 'ok');
    });

    /* "/" foca a busca */
    document.addEventListener('keydown', function (ev) {
      if (ev.key === '/' && document.activeElement !== el.busca) {
        ev.preventDefault();
        el.busca.focus();
      }
    });

    /* Se o dono mexer no painel em outra aba, o cardapio
       desta aba se atualiza sozinho. */
    window.addEventListener('storage', function (ev) {
      if (ev.key !== 'cardapio:data:v1' || !ev.newValue) return;
      try {
        Store.importarTexto(ev.newValue);
        avisar('Cardápio atualizado ✅', 'ok');
      } catch (e) { /* ignora gravacao invalida */ }
    });
  }

  /* =========================================================
     Boot
     ========================================================= */
  function iniciar() {
    el = {
      nome: $('#marcaNome'),
      sub: $('#marcaSub'),
      logo: $('#marcaLogo'),
      status: $('#marcaStatus'),
      avisoFechado: $('#avisoFechado'),
      avisoFechadoTexto: $('#avisoFechadoTexto'),
      abas: $('#abasCategorias'),
      lista: $('#listaCategorias'),
      busca: $('#campoBusca'),
      limpar: $('#buscaLimpar'),
      btnCarrinho: $('#botaoCarrinho'),
      cfTotal: $('#cfTotal'),
      cfQtd: $('#cfQtd'),
      cfSub: $('#cfSub'),
      overlay: $('#overlay'),
      modalTitulo: $('#modalTitulo'),
      modalCorpo: $('#modalCorpo'),
      modalRodape: $('#modalRodape'),
      toasts: $('#toasts'),
      rodapeNome: $('#rodapeNome')
    };

    /* Store.iniciar() monta o cardapio em memoria na hora
       (pintura imediata) e avisa depois se o cardapio.json
       da pasta for mais recente. */
    carregarCarrinho();
    Store.iniciar();
    ligarEventos();
    Store.assinar(render);
    podarCarrinho();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
