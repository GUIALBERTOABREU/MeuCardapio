# PROMPT PARTE 1 - BASE, ESTRUTURA E DADOS

Cole **ESTA PRIMEIRA PARTE** na IA da Hostinger.

## INSTRUÇÃO

Você está criando a **BASE** do projeto Cardápio Digital. Foque em estrutura, arquivos, dados e configuração inicial. Não implemente ainda toda a lógica JS complexa. Apenas crie a estrutura fiel ao projeto existente.

## 1. PAPEL DA IA

Você é um desenvolvedor front-end especialista em criar cardápios digitais estáticos.

Recrie com **máxima fidelidade** o projeto "Cardápio Digital", preservando estrutura, nomes de arquivos, organização de pastas e dados existentes.

## 2. OBJETIVO

Criar a base estrutural completa: pastas, HTMLs base, CSS, JS iniciais, JSON, arquivos de documentação e Google Apps Script, exatamente como no projeto original.

## 3. STACK TECNOLÓGICA

- HTML5
- CSS3 Puro (sem frameworks)
- Vanilla JavaScript ES6+
- JSON
- localStorage
- 100% Estático
- Compatível com servidor HTTP (fetch)

## 4. ESTRUTURA DE PASTAS E ARQUIVOS

Crie EXATAMENTE esta estrutura:

```text
/
├── index.html
├── acompanhar.html
├── admin.html
├── gerenciar.html
├── pix.html
├── cardapio.json
├── planilha.gs
├── README.md
├── DOCS.md
├── melhorias.MD
├── NumeracaoPedidos.MD
├── DOCUMENTACAO_COMPLETA.md
├── DOCUMENTACAO_PERSONALIZACAO.md
├── GUIA_USO_KITCHEN_CLIENTE.md
├── documentacao_completa.txt
├── CORRECAO_ERRO_GRAVAR_CONFIG.md
├── texto_extraido.md
├── texto_extraido.txt
├── teste_uso.md
├── teste_uso.txt
├── prompt-cardapio-lovable.md
├── prompt-cardapio-lovable.txt
├── .gitignore
├── assets/
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── planilha.js
│   │   ├── planilha-site.js
│   │   ├── store.js
│   │   └── qrcode.min.js
│   └── img/
├── img/
├── novas_img/
└── tools/
```

## 5. CARDAPIO.JSON - PRESERVAR FIELMENTE

Crie o `cardapio.json` com **TODOS** os itens originais e **EXATAMENTE** a estrutura atual.

### Estrutura obrigatória

```json
{
  "categorias": [
    { "id": "lanches", "nome": "LANCHES" },
    { "id": "bebidas", "nome": "BEBIDAS" },
    { "id": "salgados", "nome": "SALGADOS" },
    { "id": "doces", "nome": "DOCES" },
    { "id": "combos", "nome": "COMBOS" }
  ],
  "itens": [...]
}
```

### Personalização Multi-Ingredientes (OBRIGATÓRIO)

Incluir `personalizacao` com a estrutura **Opção C** nos seguintes itens:

- X-TUDO
- X-BACON
- X-SALADA
- X-FRANGO
- X-EGG

**Estrutura da personalizacao:**

```json
"personalizacao": {
  "permitir": true,
  "remover": {
    "titulo": "Remover ingredientes",
    "permitir": true,
    "max": 6,
    "opcoes": [...]
  },
  "adicionais": [
    {
      "titulo": "Adicionais",
      "tipo": "checkbox",
      "obrigatorio": false,
      "min": 0,
      "max": 6,
      "opcoes": [
        { "id": "...", "nome": "...", "preco": 3.00 }
      ]
    }
  ],
  "observacao": {
    "permitir": true,
    "placeholder": "Ex.: Bem passado, sem cebola..."
  }
}
```

**Demais itens NÃO devem ter personalizacao.** Manter exatamente os preços, descrições, ids e categorias originais.

## 6. PLANILHA.GS - CORREÇÃO CRÍTICA

Copiar **INTEIRO** o `planilha.gs` original, porém **SUBSTITUIR APENAS** a função `aplicarLinksImagem()` por esta versão corrigida:

```js
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
      richArr.push([{ text: url, textLink: { url: url } }]);
      temLinkValido = true;
    } else {
      richArr.push([{ text: '', textLink: null }]);
    }
  }
  if (temLinkValido) {
    range.setRichTextValues(richArr);
  }
}
```

Demais funções devem permanecer **IDÊNTICAS** ao original.

## 7. ARQUIVOS .MD E .TXT

Recriar **TODOS** os arquivos de documentação com seu conteúdo original:

- DOCUMENTACAO_COMPLETA.md
- DOCUMENTACAO_PERSONALIZACAO.md
- GUIA_USO_KITCHEN_CLIENTE.md
- documentacao_completa.txt
- CORRECAO_ERRO_GRAVAR_CONFIG.md
- texto_extraido.md / .txt
- teste_uso.md / .txt
- prompt-cardapio-lovable.md / .txt
- README.md, DOCS.md, melhorias.MD, NumeracaoPedidos.MD
- .gitignore

Preservar 100% dos textos.

## 8. HTMLS BASE + CSS + JS INICIAIS

Criar os 5 HTMLs com sua estrutura base, linkar CSS/JS corretos, manter meta tags, viewport e referências existentes.

Criar `assets/css/style.css` com os estilos originais.

Criar os arquivos JS: `app.js`, `planilha.js`, `planilha-site.js`, `store.js`, `qrcode.min.js` com estrutura inicial (pode ser esqueleto funcional, mas já linkados corretamente).

## 9. REQUISITOS PARA ESTA PARTE

- Estrutura 100% fiel
- cardapio.json com personalização correta
- planilha.gs com correção aplicada
- Todos os .md/.txt presentes
- HTMLs/CSS/JS criados e linkados
- Sem inventar arquivos extras
- Código limpo e organizado

## 10. RESULTADO ESPERADO

Após esta Parte 1, o projeto deve ter **APENAS A BASE ESTRUTURAL COMPLETA**. Não precisa ter ainda o modal de personalização 100% funcional, nem toda a lógica final. Apenas estrutura, dados e arquivos corretos.

**PRÓXIMA ETAPA:** Parte 2 irá implementar toda a lógica (modal multi-ingredientes, carrinho com variações, exibição condicional em acompanhar/gerenciar, toast, confirmação Entregue, botão desabilitado, etc.)

**RESPONDA EM PORTUGUÊS BRASIL. SEJA FIEL AO PROJETO ORIGINAL.**