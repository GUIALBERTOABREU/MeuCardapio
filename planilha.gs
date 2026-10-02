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
 *   ?callback=nome   devolve os links de imagem da aba Cardápio
 *                    embrulhados em `nome({...})` — é JSONP
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

  var links;

  try {
    links = lerLinksImagem();
  } catch (erro) {
    registrar('erro', 'leitura de imagens: ' + erro.message);
    return responderJsonp(callback, { ok: false, erro: erro.message });
  }

  return responderJsonp(callback, { ok: true, imagens: links });
}

/**
 * Lê a coluna "Link da imagem" da aba Cardápio.
 * A chave é "categoria|nome" para não confundir itens de mesmo
 * nome em categorias diferentes — o cardápio tem "Batata Frita"
 * em dois lugares com nomes iguais.
 */
function lerLinksImagem() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_CARDAPIO);

  if (!aba || aba.getLastRow() < 2) return {};

  var cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var colCategoria = cabecalho.indexOf('Categoria') + 1;
  var colItem = cabecalho.indexOf('Item') + 1;
  var colLink = cabecalho.indexOf('Link da imagem') + 1;

  if (!colItem || !colLink) return {};

  var ultima = aba.getLastRow();

  /* Só as três colunas necessárias: ler a aba inteira gastaria
     cota do Google à toa numa planilha grande. */
  var valores = aba.getRange(2, 1, ultima - 1, cabecalho.length).getValues();
  var mapa = {};

  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];
    var link = String(linha[colLink - 1] || '').trim();
    if (!/^https?:\/\/\S+$/i.test(link)) continue;

    var categoria = colCategoria ? String(linha[colCategoria - 1] || '').trim() : '';
    var item = String(linha[colItem - 1] || '').trim();
    if (!item) continue;

    mapa[categoria + '|' + item] = link;
  }

  return mapa;
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