/**
 * Cardápio digital → Google Sheets
 * --------------------------------
 * Recebe o cardápio e os pedidos e grava em abas separadas:
 *
 *   Pedidos   → uma linha por pedido (fixo, cabeçalho nunca muda)
 *   Itens     → uma linha por item pedido (formato longo, dá pra somar)
 *   Cardápio  → uma linha por item do cardápio (estado atual)
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

/** GET só serve para confirmar que o Web App está no ar. */
function doGet() {
  return responder({
    ok: true,
    mensagem: 'Cardápio digital conectado. Não é preciso abrir esta URL no navegador.'
  });
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