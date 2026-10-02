/* =============================================================
   admin.js  —  painel do dono: categorias, itens, configuracoes
   e manuseio do arquivo cardapio.json
   ============================================================= */
(function () {
  'use strict';

  var Store = window.CardapioStore;
  var Admin = Store.admin;

  var el = {};
  var abaAtual = 'itens';

  /* =========================================================
     Utilitarios
     ========================================================= */
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function $(s) { return document.querySelector(s); }
  function $$now(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  function moeda(v) {
    return (Store.dados().config.simboloMoeda || 'R$') + ' ' +
      (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  var MAX_TOASTS = 3;

  function avisar(msg, tipo) {
    /* Com varias abas abertas, cada gravacao gera um aviso em cada
       aba. Sem agrupar, a tela enche de toasts repetidos. */
    var anteriores = el.toasts.querySelectorAll('.toast');
    for (var i = 0; i < anteriores.length; i++) {
      if (anteriores[i].textContent === msg) return; /* ja avisou */
    }
    while (el.toasts.children.length >= MAX_TOASTS) {
      el.toasts.firstElementChild.remove();
    }

    var t = document.createElement('div');
    t.className = 'toast' + (tipo ? ' toast-' + tipo : '');
    t.textContent = msg;
    el.toasts.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s';
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 260);
    }, 2600);
  }

  /* =========================================================
     Login
     ========================================================= */
  function montarLogin() {
    /* A tela de login vem oculta no HTML para nao piscar antes do JS
       decidir. Aqui ela precisa aparecer de fato. */
    el.telaLogin.classList.remove('oculto');
    el.loginDica.textContent = 'Senha padrão: "' + Admin.senhaPadrao + '". Troque em Configurações.';

    function tentar() {
      var senha = el.loginSenha.value;
      if (!senha) { mostrarErro('Informe a senha.'); return; }

      Admin.conferirSenha(senha).then(function (ok) {
        if (ok) {
          el.telaLogin.classList.add('oculto');
          el.telaAdmin.classList.remove('oculto');
          renderTudo();
          Admin.senhaEhPadrao().then(function (padrao) {
            if (padrao) avisar('Troque a senha padrão em Configurações.', 'erro');
          });
        } else {
          mostrarErro('Senha incorreta.');
          el.loginSenha.select();
        }
      });
    }

    function mostrarErro(msg) {
      el.loginErro.textContent = msg;
      el.loginErro.classList.remove('oculto');
    }

    el.loginEntrar.addEventListener('click', tentar);
    el.loginSenha.addEventListener('keydown', function (e) { if (e.key === 'Enter') tentar(); });
    el.loginSenha.addEventListener('input', function () { el.loginErro.classList.add('oculto'); });
    el.loginSenha.focus();
  }

  /* =========================================================
     Abas
     ========================================================= */
  function trocarAba(nome) {
    abaAtual = nome;
    /* Padrao de tablist: so a aba ativa entra na ordem do Tab,
       as demais sao alcancadas com as setas do teclado. */
    $$now('.aba-admin').forEach(function (b) {
      var ativa = b.getAttribute('data-tab') === nome;
      b.setAttribute('aria-selected', ativa ? 'true' : 'false');
      b.tabIndex = ativa ? 0 : -1;
    });
    el.tabItens.classList.toggle('oculto', nome !== 'itens');
    el.tabConfig.classList.toggle('oculto', nome !== 'config');
    el.tabJson.classList.toggle('oculto', nome !== 'json');
    if (nome === 'config') preencherConfig();
    if (nome === 'json') el.textareaJson.value = Store.serializar();
  }

  /* =========================================================
     Aba: itens e categorias
     ========================================================= */
  function renderEstatisticas() {
    var cats = Store.dados().categorias;
    var itens = cats.reduce(function (n, c) { return n + (c.itens || []).length; }, 0);
    var indisponiveis = 0;
    cats.forEach(function (c) {
      (c.itens || []).forEach(function (i) { if (i.disponivel === false) indisponiveis++; });
    });

    el.estatisticas.innerHTML =
      '<div class="estat"><b>' + cats.length + '</b><span>categorias</span></div>' +
      '<div class="estat"><b>' + itens + '</b><span>itens</span></div>' +
      '<div class="estat"><b>' + indisponiveis + '</b><span>indisponíveis</span></div>' +
      '<div class="estat"><b>' + new Date().toLocaleDateString('pt-BR') + '</b><span>última edição</span></div>';
  }

  function renderCategorias() {
    var cats = Store.dados().categorias;

    if (!cats.length) {
      el.listaCategorias.innerHTML =
        '<div class="vazio"><span class="vazio-icone">📂</span>' +
        '<p>Nenhuma categoria ainda.</p>' +
        '<button type="button" class="btn btn-primario btn-sm" data-nova-categoria>+ Criar primeira categoria</button></div>';
      return;
    }

    el.listaCategorias.innerHTML = cats.map(function (cat, indice) {
      var lista = cat.itens || [];
      var itens = lista.map(function (item, pos) { return linhaItem(item, pos, lista.length); }).join('');

      return '' +
      '<div class="categoria-bloco" data-cat="' + esc(cat.id) + '">' +
        '<div class="categoria-topo">' +
          '<input type="text" class="categoria-icone" value="' + esc(cat.icone) + '" maxlength="4" ' +
            'data-edit-campo="icone" data-cat="' + esc(cat.id) + '" aria-label="Ícone da categoria">' +
          '<div style="min-width:0">' +
            '<input type="text" class="categoria-nome" value="' + esc(cat.nome) + '" ' +
              'data-edit-campo="nome" data-cat="' + esc(cat.id) + '" aria-label="Nome da categoria" ' +
              'style="border:0;background:transparent;padding:2px 0;font-weight:700;width:100%">' +
            '<div class="categoria-meta">' + (cat.itens || []).length + ' item(ns)</div>' +
          '</div>' +
          '<div class="acoes">' +
            '<button type="button" class="btn btn-icone btn-contorno" data-add-item="' + esc(cat.id) + '" title="Adicionar item">+</button>' +
            '<button type="button" class="btn btn-icone btn-contorno" data-mover-cat="' + esc(cat.id) + '" data-dir="-1" title="Subir" ' + (indice === 0 ? 'disabled' : '') + '>↑</button>' +
            '<button type="button" class="btn btn-icone btn-contorno" data-mover-cat="' + esc(cat.id) + '" data-dir="1" title="Descer" ' + (indice === cats.length - 1 ? 'disabled' : '') + '>↓</button>' +
            '<button type="button" class="btn btn-icone btn-perigo" data-excluir-cat="' + esc(cat.id) + '" title="Excluir categoria">🗑</button>' +
          '</div>' +
        '</div>' +
        '<div class="categoria-corpo">' + (itens || '<p class="dica" style="margin:4px;color:var(--texto-tenue)">Nenhum item. Use o botão + para adicionar.</p>') + '</div>' +
      '</div>';
    }).join('');
  }

  function linhaItem(item, posicao, total) {
    return '' +
    '<div class="item-admin' + (item.disponivel === false ? ' indisponivel' : '') + '" data-item="' + esc(item.id) + '">' +
      '<button type="button" class="btn btn-icone btn-contorno" data-toggle-item="' + esc(item.id) + '" ' +
        'title="' + (item.disponivel === false ? 'Marcar como disponível' : 'Marcar como indisponível') + '">' +
        (item.disponivel === false ? '🚫' : '✅') + '</button>' +
      '<button type="button" class="btn btn-icone btn-contorno" data-destaque="' + esc(item.id) + '" ' +
        'title="' + (item.destaque ? 'Remover destaque' : 'Marcar como destaque') + '">' + (item.destaque ? '⭐' : '☆') + '</button>' +
      '<span class="item-admin-nome">' + esc(item.nome) +
        (item.descricao ? '<small>' + esc(item.descricao) + '</small>' : '') + '</span>' +
      '<span class="item-admin-preco">' + moeda(item.preco) + '</span>' +
      '<div class="acoes">' +
        '<button type="button" class="btn btn-icone btn-contorno" data-mover-item="' + esc(item.id) + '" data-dir="-1" title="Subir"' + (posicao === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="btn btn-icone btn-contorno" data-mover-item="' + esc(item.id) + '" data-dir="1" title="Descer"' + (posicao === total - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="btn btn-icone btn-contorno" data-editar-item="' + esc(item.id) + '" title="Editar">✎</button>' +
        '<button type="button" class="btn btn-icone btn-perigo" data-excluir-item="' + esc(item.id) + '" title="Excluir">🗑</button>' +
      '</div>' +
    '</div>';
  }

  /* ---------- acoes de item ---------- */
  function acharItem(id) {
    var achado = null;
    Store.dados().categorias.forEach(function (c) {
      (c.itens || []).forEach(function (i) { if (i.id === id) achado = { item: i, cat: c }; });
    });
    return achado;
  }

  function editarItem(id) {
    var achado = acharItem(id);
    if (!achado) return;
    var item = achado.item;

    abrirModal('Editar item', '' +
      '<div class="empilha">' +
        '<div class="campo"><label for="mNome">Nome *</label>' +
        '<input type="text" id="mNome" value="' + esc(item.nome) + '" maxlength="80"></div>' +
        '<div class="campo"><label for="mDescricao">Descrição</label>' +
        '<textarea id="mDescricao" maxlength="240" placeholder="Ingredientes, porção, acompanhamentos…">' + esc(item.descricao) + '</textarea></div>' +
        '<div class="campo"><label for="mPreco">Preço (R$) *</label>' +
        '<input type="text" id="mPreco" inputmode="decimal" value="' + precoParaCampo(item.preco) + '"></div>' +
        '<div class="campo"><label for="mImagem">URL da foto (opcional)</label>' +
        '<input type="url" id="mImagem" value="' + esc(item.imagem) + '" placeholder="https://…/foto.jpg"></div>' +
        '<label class="chave"><span>Marcar como destaque</span><input type="checkbox" id="mDestaque"' + (item.destaque ? ' checked' : '') + '></label>' +
        '<label class="chave"><span>Disponível para pedido</span><input type="checkbox" id="mDisponivel"' + (item.disponivel === false ? '' : ' checked') + '></label>' +
      '</div>', '' +
      '<button type="button" class="btn btn-primario btn-bloco" data-salvar-item="' + esc(item.id) + '">Salvar alterações</button>' +
      '<button type="button" class="btn btn-contorno btn-bloco" data-fechar>Cancelar</button>');
  }

  /* Aceita "12,50", "12.50" ou "12,5" e devolve numero. */
  function lerPreco(valor) {
    var n = parseFloat(String(valor || '').replace(',', '.').trim());
    return isFinite(n) && n >= 0 ? n : NaN;
  }

  /* Mostra o preco no formato brasileiro dentro dos formularios. */
  function precoParaCampo(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function salvarItem(id) {
    var nome = el.modalCorpo.querySelector('#mNome').value.trim();
    var preco = lerPreco(el.modalCorpo.querySelector('#mPreco').value);

    if (!nome) { avisar('O nome do item é obrigatório.', 'erro'); return; }
    if (!isFinite(preco)) { avisar('Informe um preço válido (ex.: 12,50).', 'erro'); return; }

    Store.alterar(function (d) {
      d.categorias.forEach(function (c) {
        (c.itens || []).forEach(function (i) {
          if (i.id !== id) return;
          i.nome = nome;
          i.descricao = el.modalCorpo.querySelector('#mDescricao').value.trim();
          i.preco = Math.round(preco * 100) / 100;
          i.imagem = el.modalCorpo.querySelector('#mImagem').value.trim();
          i.destaque = el.modalCorpo.querySelector('#mDestaque').checked;
          i.disponivel = el.modalCorpo.querySelector('#mDisponivel').checked;
        });
      });
    });

    fecharModal();
    avisar('Item atualizado ✅', 'ok');
  }

  function novoItem(catId) {
    abrirModal('Novo item', '' +
      '<div class="empilha">' +
        '<div class="campo"><label for="mNome">Nome *</label>' +
        '<input type="text" id="mNome" placeholder="Ex.: X-Salada" maxlength="80"></div>' +
        '<div class="campo"><label for="mDescricao">Descrição</label>' +
        '<textarea id="mDescricao" maxlength="240" placeholder="Ingredientes, porção, acompanhamentos…"></textarea></div>' +
        '<div class="campo"><label for="mPreco">Preço (R$) *</label>' +
        '<input type="text" id="mPreco" inputmode="decimal" placeholder="0,00"></div>' +
        '<div class="campo"><label for="mImagem">URL da foto (opcional)</label>' +
        '<input type="url" id="mImagem" placeholder="https://…/foto.jpg"></div>' +
        '<label class="chave"><span>Marcar como destaque</span><input type="checkbox" id="mDestaque"></label>' +
        '<label class="chave"><span>Disponível para pedido</span><input type="checkbox" id="mDisponivel" checked></label>' +
      '</div>', '' +
      '<button type="button" class="btn btn-primario btn-bloco" data-criar-item="' + esc(catId) + '">Adicionar item</button>' +
      '<button type="button" class="btn btn-contorno btn-bloco" data-fechar>Cancelar</button>');

    setTimeout(function () { el.modalCorpo.querySelector('#mNome').focus(); }, 80);
  }

  function criarItem(catId) {
    var nome = el.modalCorpo.querySelector('#mNome').value.trim();
    var preco = lerPreco(el.modalCorpo.querySelector('#mPreco').value);

    if (!nome) { avisar('O nome do item é obrigatório.', 'erro'); return; }
    if (!isFinite(preco)) { avisar('Informe um preço válido (ex.: 12,50).', 'erro'); return; }

    var novo = {
      id: Store.slug(nome),
      nome: nome,
      descricao: el.modalCorpo.querySelector('#mDescricao').value.trim(),
      preco: Math.round(preco * 100) / 100,
      imagem: el.modalCorpo.querySelector('#mImagem').value.trim(),
      destaque: el.modalCorpo.querySelector('#mDestaque').checked,
      disponivel: el.modalCorpo.querySelector('#mDisponivel').checked
    };

    Store.alterar(function (d) {
      var cat = d.categorias.filter(function (c) { return c.id === catId; })[0];
      if (!cat) { avisar('Categoria não encontrada.', 'erro'); return; }
      cat.itens.push(novo);
    });

    fecharModal();
    avisar('Item adicionado ✅', 'ok');
  }

  function excluirItem(id) {
    var achado = acharItem(id);
    if (!achado) return;
    if (!confirm('Excluir "' + achado.item.nome + '"? Essa ação não pode ser desfeita.')) return;

    Store.alterar(function (d) {
      d.categorias.forEach(function (c) {
        c.itens = (c.itens || []).filter(function (i) { return i.id !== id; });
      });
    });
    avisar('Item excluído');
  }

  function moverItem(id, dir) {
    Store.alterar(function (d) {
      d.categorias.forEach(function (c) {
        var itens = c.itens || [];
        var i = itens.findIndex(function (x) { return x.id === id; });
        var j = i + Number(dir);
        if (i < 0 || j < 0 || j >= itens.length) return;
        var tmp = itens[i];
        itens[i] = itens[j];
        itens[j] = tmp;
      });
    });
  }

  /* ---------- acoes de categoria ---------- */
  function novaCategoria() {
    abrirModal('Nova categoria', '' +
      '<div class="empilha">' +
        '<div class="campo"><label for="mNome">Nome *</label>' +
        '<input type="text" id="mNome" placeholder="Ex.: Porções" maxlength="60"></div>' +
        '<div class="campo"><label for="mIcone">Ícone (emoji)</label>' +
        '<input type="text" id="mIcone" maxlength="4" placeholder="🍟"></div>' +
      '</div>', '' +
      '<button type="button" class="btn btn-primario btn-bloco" data-criar-cat>Adicionar categoria</button>' +
      '<button type="button" class="btn btn-contorno btn-bloco" data-fechar>Cancelar</button>');

    setTimeout(function () { el.modalCorpo.querySelector('#mNome').focus(); }, 80);
  }

  function criarCategoria() {
    var nome = el.modalCorpo.querySelector('#mNome').value.trim();
    var icone = el.modalCorpo.querySelector('#mIcone').value.trim() || '🍽️';
    if (!nome) { avisar('O nome da categoria é obrigatório.', 'erro'); return; }

    Store.alterar(function (d) {
      d.categorias.push({ id: Store.slug(nome), nome: nome, icone: icone, itens: [] });
    });
    fecharModal();
    avisar('Categoria criada ✅', 'ok');
  }

  function excluirCategoria(catId) {
    var cat = Store.dados().categorias.filter(function (c) { return c.id === catId; })[0];
    if (!cat) return;

    var total = (cat.itens || []).length;
    var msg = total
      ? 'Excluir "' + cat.nome + '" e seus ' + total + ' item(ns)?'
      : 'Excluir a categoria "' + cat.nome + '"?';
    if (!confirm(msg)) return;

    Store.alterar(function (d) {
      d.categorias = d.categorias.filter(function (c) { return c.id !== catId; });
    });
    avisar('Categoria excluída');
  }

  function moverCategoria(catId, dir) {
    Store.alterar(function (d) {
      var i = d.categorias.findIndex(function (c) { return c.id === catId; });
      var j = i + Number(dir);
      if (i < 0 || j < 0 || j >= d.categorias.length) return;
      var tmp = d.categorias[i];
      d.categorias[i] = d.categorias[j];
      d.categorias[j] = tmp;
    });
  }

  /* ---------- edicao inline (nome/icone da categoria) ---------- */
  function editarInline(campo, catId, valor) {
    Store.alterar(function (d) {
      d.categorias.forEach(function (c) {
        if (c.id !== catId) return;
        if (campo === 'nome') {
          if (!valor.trim()) return;
          c.nome = valor.trim();
        } else {
          c.icone = valor.trim() || '🍽️';
        }
      });
    });
  }

  /* =========================================================
     Aba: configuracoes
     ========================================================= */
  function preencherConfig() {
    var c = Store.dados().config;
    el.cfgNome.value = c.nome;
    el.cfgWhatsapp.value = c.whatsapp;
    el.cfgDescricao.value = c.descricao;
    el.cfgCor.value = c.corPrimaria;
    el.cfgTaxa.value = precoParaCampo(c.taxaEntrega);
    el.cfgMinimo.value = precoParaCampo(c.pedidoMinimo);
    el.cfgSimbolo.value = c.simboloMoeda;
    el.cfgAbertura.value = c.mensagemAbertura;
    el.cfgFechado.value = c.mensagemFechado;
    el.cfgAberto.checked = c.aberto;
    el.cfgPedirNome.checked = c.pedirNome !== false;
    el.cfgPedirEntrega.checked = c.pedirEntrega !== false;
    el.cfgPlanilhaUrl.value = c.planilhaUrl || '';
    el.cfgPlanilhaToken.value = c.planilhaToken || '';
  }

  function salvarConfig(campo, valor) {
    Store.alterar(function (d) { d.config[campo] = valor; });
  }

  function ligarConfig() {
    var mapa = {
      cfgNome: ['nome', 'texto'],
      cfgWhatsapp: ['whatsapp', 'digitos'],
      cfgDescricao: ['descricao', 'texto'],
      cfgCor: ['corPrimaria', 'texto'],
      cfgTaxa: ['taxaEntrega', 'numero'],
      cfgMinimo: ['pedidoMinimo', 'numero'],
      cfgSimbolo: ['simboloMoeda', 'texto'],
      cfgAbertura: ['mensagemAbertura', 'texto'],
      cfgFechado: ['mensagemFechado', 'texto'],
      cfgAberto: ['aberto', 'bool'],
      cfgPedirNome: ['pedirNome', 'bool'],
      cfgPedirEntrega: ['pedirEntrega', 'bool'],
      cfgPlanilhaUrl: ['planilhaUrl', 'planilha'],
      cfgPlanilhaToken: ['planilhaToken', 'texto']
    };

    Object.keys(mapa).forEach(function (id) {
      var campo = mapa[id][0];
      var tipo = mapa[id][1];
      var node = el[id];

      var evento = (node.type === 'color' || node.type === 'checkbox' || node.tagName === 'SELECT') ? 'change' : 'input';

      node.addEventListener(evento, function () {
        var v;
        if (tipo === 'bool') v = node.checked;
        else if (tipo === 'numero') v = Math.max(0, lerPreco(node.value) || 0);
        else if (tipo === 'digitos') v = node.value.replace(/\D/g, '');
        else if (tipo === 'planilha') {
          v = node.value.trim();
          /* A URL so e salva se o endereco fizer sentido. Aceitar
             qualquer texto deixaria o dono achando que estava
             gravando quando o navegador so recusaria em silencio. */
          if (v && !/^https:\/\/script\.google(usercontent)?\.com\//i.test(v)) {
            avisar('A URL precisa começar com https://script.google.com/', 'erro');
            return;
          }
        }
        else v = node.value;
        salvarConfig(campo, v);
      });
    });

    el.btnTrocarSenha.addEventListener('click', function () {
      var nova = el.cfgSenha.value;
      Admin.definirSenha(nova).then(
        function () {
          el.cfgSenha.value = '';
          avisar('Senha alterada ✅', 'ok');
        },
        function (erro) { avisar(erro.message, 'erro'); }
      );
    });

    ligarPlanilha();
  }

  /* =========================================================
     Aba: Google Sheets
     ========================================================= */
  function ligarPlanilha() {
    var P = window.CardapioPlanilha;

    if (!P) {
      el.btnEnviarCardapio.disabled = true;
      el.btnTestarPlanilha.disabled = true;
      return;
    }

    function semUrl() {
      avisar('Cole a URL do Web App primeiro.', 'erro');
      el.cfgPlanilhaUrl.focus();
    }

    el.btnEnviarCardapio.addEventListener('click', function () {
      if (!P.configurada()) return semUrl();

      var botao = el.btnEnviarCardapio;
      botao.disabled = true;
      el.resultadoPlanilha.textContent = 'Enviando…';

      P.enviarCardapio().then(function (r) {
        botao.disabled = false;
        el.resultadoPlanilha.textContent = r.itens + ' item(ns) enviados. Confira a aba "Cardápio" em alguns segundos.';
        avisar(r.itens + ' itens enviados para a planilha ✅', 'ok');
      }, function (erro) {
        botao.disabled = false;
        el.resultadoPlanilha.textContent = erro.message;
        avisar('Falha ao enviar o cardápio.', 'erro');
      });
    });

    /* O POST vai em no-cors, entao o navegador nunca mostra o que
       o script respondeu. Este teste so prova que a chamada saiu;
       a confirmacao de verdade e ver a aba "Registro" do script.
       E por isso que o script guarda o historico la. */
    el.btnTestarPlanilha.addEventListener('click', function () {
      if (!P.configurada()) return semUrl();

      var botao = el.btnTestarPlanilha;
      botao.disabled = true;
      el.resultadoPlanilha.textContent = 'Testando…';

      P.enviarPedido({
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        pedido: 'TESTE',
        cliente: 'Teste de conexao',
        tipo: 'retirada',
        endereco: '',
        pagamento: '',
        observacoes: 'Linha criada pelo botao "Testar conexao". Pode apagar.',
        itens: [{ nome: 'Item de teste', quantidade: 1, precoUnitario: 0, observacao: '' }],
        subtotal: 0, taxa: 0, total: 0
      }).then(function () {
        botao.disabled = false;
        el.resultadoPlanilha.textContent =
          'Chamada enviada. Se nada apareceu na aba "Pedidos" em ~30s, confira se o Web App foi publicado como "Anyone" e se o token bate.';
      }, function (erro) {
        botao.disabled = false;
        el.resultadoPlanilha.textContent = erro.message;
      });
    });
  }

  /* =========================================================
     Aba: JSON
     ========================================================= */
  function ligarJson() {
    el.btnExportar.addEventListener('click', function () {
      Store.baixar('cardapio.json', Store.serializar());
      avisar('cardapio.json baixado 📄', 'ok');
    });

    el.btnCopiar.addEventListener('click', function () {
      var texto = el.textareaJson.value || Store.serializar();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(
          function () { avisar('JSON copiado 📋', 'ok'); },
          function () { avisar('Não foi possível copiar. Selecione o texto manualmente.', 'erro'); }
        );
      } else {
        el.textareaJson.select();
        avisar('Selecione e copie com Ctrl+C.', 'erro');
      }
    });

    el.btnImportar.addEventListener('click', function () { el.inputArquivo.click(); });

    el.inputArquivo.addEventListener('change', function () {
      var arquivo = this.files && this.files[0];
      if (!arquivo) return;

      if (!confirm('Importar "' + arquivo.name + '" vai substituir o cardápio atual. Continuar?')) {
        this.value = '';
        return;
      }

      var leitor = new FileReader();
      leitor.onload = function () {
        try {
          var resultado = Store.importarTexto(String(leitor.result));
          mostrarResultado('Cardápio importado ✅', resultado.avisos, resultado.erros);
          renderTudo();
        } catch (e) {
          mostrarResultado('Falha na importação', [e.message], []);
        }
        this.value = '';
      }.bind(this);
      leitor.readAsText(arquivo, 'utf-8');
    });

    el.btnSalvarTexto.addEventListener('click', function () {
      try {
        var resultado = Store.importarTexto(el.textareaJson.value);
        mostrarResultado('Alterações salvas ✅', resultado.avisos, resultado.erros);
        renderTudo();
      } catch (e) {
        mostrarResultado('Não foi possível salvar', [e.message], []);
      }
    });

    el.btnAtualizarJson.addEventListener('click', function () {
      el.textareaJson.value = Store.serializar();
      avisar('Visualização atualizada');
    });

    el.btnResetar.addEventListener('click', function () {
      if (!confirm('Restaurar o cardápio de exemplo? Tudo o que você editou será perdido.')) return;
      Store.resetar();
      el.textareaJson.value = Store.serializar();
      renderTudo();
      avisar('Cardápio de exemplo restaurado');
    });
  }

  function mostrarResultado(titulo, avisos, erros) {
    var html = '<p style="margin:0 0 8px;font-weight:700">' + esc(titulo) + '</p>';

    if (erros && erros.length) {
      html += '<ul class="lista-avisos erros">' +
        erros.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    }
    if (avisos && avisos.length) {
      html += '<ul class="lista-avisos" style="margin-top:8px">' +
        avisos.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    }
    if ((!erros || !erros.length) && (!avisos || !avisos.length)) {
      html += '<p class="dica" style="color:var(--sucesso);font-weight:600">Tudo certo, sem avisos.</p>';
    }

    el.resultadoJson.innerHTML = html;
  }

  /* =========================================================
     Modal generico
     ========================================================= */
  function abrirModal(titulo, corpo, rodape) {
    el.modalTitulo.textContent = titulo;
    el.modalCorpo.innerHTML = corpo;
    el.modalRodape.innerHTML = rodape;
    el.overlay.classList.remove('oculto');
    document.body.classList.add('travado');
  }

  function fecharModal() {
    el.overlay.classList.add('oculto');
    document.body.classList.remove('travado');
  }

  /* =========================================================
     Eventos globais
     ========================================================= */
  function ligarEventos() {
    $$now('.aba-admin').forEach(function (b) {
      b.addEventListener('click', function () { trocarAba(b.getAttribute('data-tab')); });
    });

    /* Navegacao de abas pelo teclado: <- e -> mudam de aba. */
    var listaAbas = $$now('.aba-admin');
    listaAbas.forEach(function (b, i) {
      b.addEventListener('keydown', function (ev) {
        var alvo = null;
        if (ev.key === 'ArrowRight') alvo = listaAbas[(i + 1) % listaAbas.length];
        if (ev.key === 'ArrowLeft') alvo = listaAbas[(i - 1 + listaAbas.length) % listaAbas.length];
        if (ev.key === 'Home') alvo = listaAbas[0];
        if (ev.key === 'End') alvo = listaAbas[listaAbas.length - 1];
        if (!alvo) return;
        ev.preventDefault();
        trocarAba(alvo.getAttribute('data-tab'));
        alvo.focus();
      });
    });

    el.btnNovaCategoria.addEventListener('click', novaCategoria);

    el.listaCategorias.addEventListener('click', function (ev) {
      var t = ev.target;

      var addItem = t.closest('[data-add-item]');
      if (addItem) { novoItem(addItem.getAttribute('data-add-item')); return; }

      var moverCat = t.closest('[data-mover-cat]');
      if (moverCat) { moverCategoria(moverCat.getAttribute('data-mover-cat'), moverCat.getAttribute('data-dir')); return; }

      var excCat = t.closest('[data-excluir-cat]');
      if (excCat) { excluirCategoria(excCat.getAttribute('data-excluir-cat')); return; }

      var toggle = t.closest('[data-toggle-item]');
      if (toggle) {
        var idT = toggle.getAttribute('data-toggle-item');
        Store.alterar(function (d) {
          d.categorias.forEach(function (c) {
            (c.itens || []).forEach(function (i) {
              if (i.id === idT) i.disponivel = i.disponivel === false;
            });
          });
        });
        return;
      }

      var destaque = t.closest('[data-destaque]');
      if (destaque) {
        var idD = destaque.getAttribute('data-destaque');
        Store.alterar(function (d) {
          d.categorias.forEach(function (c) {
            (c.itens || []).forEach(function (i) {
              if (i.id === idD) i.destaque = !i.destaque;
            });
          });
        });
        return;
      }

      var mover = t.closest('[data-mover-item]');
      if (mover) { moverItem(mover.getAttribute('data-mover-item'), mover.getAttribute('data-dir')); return; }

      var ed = t.closest('[data-editar-item]');
      if (ed) { editarItem(ed.getAttribute('data-editar-item')); return; }

      var exc = t.closest('[data-excluir-item]');
      if (exc) { excluirItem(exc.getAttribute('data-excluir-item')); return; }

      if (t.closest('[data-nova-categoria]')) { novaCategoria(); return; }
    });

    /* edicao inline de nome/icone */
    el.listaCategorias.addEventListener('change', function (ev) {
      var campo = ev.target.getAttribute('data-edit-campo');
      if (!campo) return;
      editarInline(campo, ev.target.getAttribute('data-cat'), ev.target.value);
    });

    /* acoes do modal */
    el.modalRodape.addEventListener('click', function (ev) {
      var t = ev.target;

      if (t.closest('[data-fechar]')) { fecharModal(); return; }

      var salvar = t.closest('[data-salvar-item]');
      if (salvar) { salvarItem(salvar.getAttribute('data-salvar-item')); return; }

      var criar = t.closest('[data-criar-item]');
      if (criar) { criarItem(criar.getAttribute('data-criar-item')); return; }

      if (t.closest('[data-criar-cat]')) { criarCategoria(); return; }
    });

    /* enter no nome do item cria/salva */
    el.modalCorpo.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      if (ev.target.id !== 'mNome' && ev.target.id !== 'mPreco') return;
      var acao = el.modalRodape.querySelector('[data-salvar-item], [data-criar-item], [data-criar-cat]');
      if (acao) acao.click();
    });

    el.modalFechar.addEventListener('click', fecharModal);
    el.overlay.addEventListener('mousedown', function (ev) { if (ev.target === el.overlay) fecharModal(); });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !el.overlay.classList.contains('oculto')) fecharModal();
    });

    el.adminSair.addEventListener('click', function () {
      Admin.sair();
      location.reload();
    });

    /* outra aba alterou o cardapio: recarrega a lista */
    window.addEventListener('storage', function (ev) {
      if (ev.key !== 'cardapio:data:v1' || !ev.newValue) return;
      Store.carregar();
      renderTudo();
      avisar('Cardápio atualizado de outra aba');
    });
  }

  /* =========================================================
     Render
     ========================================================= */
  /* Apenas as listas: seguro para rodar a cada gravacao,
     porque nao mexe nos campos que o usuario esta digitando. */
  function renderListas() {
    renderEstatisticas();
    renderCategorias();
    var cfg = Store.dados().config;
    el.adminNome.textContent = cfg.nome;
    /* mesma conta de cor do cardapio: o painel acompanha a marca
       escolhida, inclusive o tom escuro que garante contraste */
    Store.aplicarCor(cfg.corPrimaria);
  }

  /* Render completo: recarrega tambem os formularios das abas. */
  function renderTudo() {
    renderListas();
    if (abaAtual === 'config') preencherConfig();
    if (abaAtual === 'json') el.textareaJson.value = Store.serializar();
  }

  /* =========================================================
     Boot
     ========================================================= */
  function iniciar() {
    el = {
      telaLogin: $('#telaLogin'),
      telaAdmin: $('#telaAdmin'),
      loginSenha: $('#loginSenha'),
      loginEntrar: $('#loginEntrar'),
      loginErro: $('#loginErro'),
      loginDica: $('#loginDica'),
      estatisticas: $('#estatisticas'),
      listaCategorias: $('#listaCategorias'),
      btnNovaCategoria: $('#btnNovaCategoria'),
      adminSair: $('#adminSair'),
      adminNome: $('#adminNome'),
      toasts: $('#toasts'),
      overlay: $('#overlay'),
      modalTitulo: $('#modalTitulo'),
      modalCorpo: $('#modalCorpo'),
      modalRodape: $('#modalRodape'),
      modalFechar: $('#modalFechar'),
      tabItens: $('#tabItens'),
      tabConfig: $('#tabConfig'),
      tabJson: $('#tabJson'),
      textareaJson: $('#textareaJson'),
      resultadoJson: $('#resultadoJson'),
      inputArquivo: $('#inputArquivo'),
      btnExportar: $('#btnExportar'),
      btnImportar: $('#btnImportar'),
      btnCopiar: $('#btnCopiar'),
      btnSalvarTexto: $('#btnSalvarTexto'),
      btnAtualizarJson: $('#btnAtualizarJson'),
      btnResetar: $('#btnResetar'),
      btnTrocarSenha: $('#btnTrocarSenha'),
      cfgNome: $('#cfgNome'),
      cfgWhatsapp: $('#cfgWhatsapp'),
      cfgDescricao: $('#cfgDescricao'),
      cfgCor: $('#cfgCor'),
      cfgTaxa: $('#cfgTaxa'),
      cfgMinimo: $('#cfgMinimo'),
      cfgSimbolo: $('#cfgSimbolo'),
      cfgAbertura: $('#cfgAbertura'),
      cfgFechado: $('#cfgFechado'),
      cfgAberto: $('#cfgAberto'),
      cfgPedirNome: $('#cfgPedirNome'),
      cfgPedirEntrega: $('#cfgPedirEntrega'),
      cfgSenha: $('#cfgSenha'),
      cfgPlanilhaUrl: $('#cfgPlanilhaUrl'),
      cfgPlanilhaToken: $('#cfgPlanilhaToken'),
      btnEnviarCardapio: $('#btnEnviarCardapio'),
      btnTestarPlanilha: $('#btnTestarPlanilha'),
      resultadoPlanilha: $('#resultadoPlanilha')
    };

    if (Admin.temSessao()) {
      el.telaLogin.classList.add('oculto');
      el.telaAdmin.classList.remove('oculto');
    } else {
      montarLogin();
    }

    Store.iniciar();
    ligarEventos();
    ligarConfig();
    ligarJson();
    Store.assinar(function () {
      if (!el.telaAdmin.classList.contains('oculto')) renderTudo();
    });
    renderTudo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
