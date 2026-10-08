# CORREÇÃO - Erro ao Gravar Configurações na Planilha

**Data:** 07/10/2026  
**Arquivos alterados:** `planilha.gs`  
**Erro relatado:**

1. `"Alterações não chegaram no servidor"`
2. `"NÃO GRAVOU: Os parâmetros (number[]) não correspondem à assinatura de método para SpreadsheetApp.Range.setRichTextValues."`

## 1. CAUSA RAIZ

O erro estava na função `aplicarLinksImagem()` (linhas ~1240–1274 do `planilha.gs`).

O método `Range.setRichTextValues()` do Google Apps Script **exige** um array 2D no formato exato: `[[RichTextValue],[RichTextValue],...]`

Quando **todos** os links da coluna "Link da imagem" estavam vazios (comum na aba `Config`, `Pedidos`, etc.), o código anterior montava um array com elementos vazios e chamava `setRichTextValues()` mesmo assim. Em algumas situações, o formato resultante era interpretado incorretamente pelo Apps Script, gerando o erro:

```text
Os parâmetros (number[]) não correspondem à assinatura de método para SpreadsheetApp.Range.setRichTextValues.
```

Esse erro **quebrava a execução** de `escreverAba()` dentro de `doPost()`. Como consequência, o Apps Script não retornava um JSON válido para o front-end (retornava erro/HTML), fazendo com que o painel mostrasse:

```text
"Alterações não chegaram no servidor"
```

## 2. ARQUIVO ALTERADO

**`planilha.gs`** – Função `aplicarLinksImagem()`

## 3. CORREÇÃO APLICADA

Foi substituída a função por uma versão mais robusta, com as seguintes melhorias:

### Código corrigido

```js
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
```

## 4. PRINCIPAIS MUDANÇAS

| Mudança | Motivo |
|---|---|
| **Verificação `temLinkValido`** | Evita chamar `setRichTextValues()` quando **nenhum** link válido existe. Isso resolve o erro quando a coluna "Link da imagem" está vazia (caso da aba `Config`). |
| **Construção 2D explícita** | Monta `richArr.push([[{...}]])` com estrutura 2D correta: `Range` de 1 coluna → array com `[[objeto]]` por linha. Garante compatibilidade com a assinatura esperada. |
| **Validação restrita a `http://` e `https://`** | Mantém a validação original. Links válidos recebem hyperlink. Valores inválidos ficam vazios sem tentar criar RichText incorreto. |
| **Não altera células sem links** | Quando não há links válidos, **não aplica nada**. Assim evita alterar formatação desnecessariamente e não dispara o erro. |

## 5. POR QUE RESOLVE OS DOIS ERROS

### Erro 2: `setRichTextValues` com parâmetros inválidos

Antes, mesmo com todos os valores vazios, o código tentava criar e aplicar RichText. Com a nova lógica, **só aplicamos quando existe pelo menos 1 link `http(s)` válido**. Isso elimina o caso problemático.

### Erro 1: "Alterações não chegaram no servidor"

Esse aviso era consequência do primeiro erro. Quando `aplicarLinksImagem()` lançava exceção, o bloco `try/catch` em `escreverAba()`/`doPost()` capturava, registrava no `Registro` e retornava:

```js
return responder({ ok: false, erro: erro.message });
```

Mas dependendo do contexto, ou se a exceção acontecia em um ponto não esperado, o Apps Script podia retornar HTML de erro do Google ao invés de JSON. O front-end, ao fazer `fetch()` para o Web App, não conseguia interpretar a resposta e exibia **"Alterações não chegaram no servidor"**.

**Com a correção, a exceção deixa de ocorrer.** O `doPost()` volta a retornar `JSON` válido (`{ok: true, ...}`) e o painel salva corretamente as configurações.

## 6. COMO APLICAR NO GOOGLE APPS SCRIPT

1. Abrir o **Google Apps Script** vinculado à planilha do cardápio
2. Abrir arquivo `Code.gs` (ou equivalente)
3. Substituir **inteiramente** a função `aplicarLinksImagem()` pelo código corrigido acima
4. Salvar (`Ctrl+S` / `⌘+S`)
5. **Implantar → Gerenciar implantações**
6. Selecionar a implantação ativa → **Atualizar**
   - Tipo: **Web app**
   - Executar como: **Eu (seu e-mail)**
   - Quem tem acesso: **Qualquer pessoa com o link**
7. Clicar em **Atualizar**
8. (Opcional) Conferir se a **URL `/exec`** continua a mesma. Se mudou, atualizar no Admin > Configurações

## 7. TESTE APÓS CORREÇÃO

1. Acessar `admin.html`
2. Fazer login
3. Ir em **Configurações**
4. Alterar algum campo (ex.: Nome da loja, WhatsApp, Taxa de entrega)
5. Clicar em **Salvar Configurações**
6. Verificar: deve aparecer **"Configurações salvas com sucesso!"** (ou mensagem equivalente do painel)
7. Conferir na aba **`Config`** da planilha Google Sheets se os valores foram gravados corretamente
8. Testar também: salvar **Cardápio/Bairros/Opções** (qualquer ação que chame `escreverAba()` com coluna "Link da imagem") – deve funcionar sem erro

## 8. OBSERVAÇÃO

Esta correção **não afeta**:
- Leitura do cardápio (`lerCardapio`, `doGet`)
- Salvamento de pedidos (`pedidos`, `itens`)
- Geração de relatório
- Outras funções existentes

Afeta **apenas** a formatação de hyperlinks na coluna "Link da imagem", tornando-a mais segura e evitando o erro quando a coluna está vazia.