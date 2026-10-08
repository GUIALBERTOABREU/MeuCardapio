# PROMPT COMPLETO - Projeto Cardápio Digital

Cole este prompt na IA de criação de sites/app da Hostinger (Hostinger AI Website Builder / AI App Builder) para recriar exatamente este projeto com todas as funcionalidades implementadas.

## Instruções de Uso

1. Copie TODO o conteúdo deste arquivo
2. Cole no assistente de IA da Hostinger
3. Peça para gerar o projeto seguindo exatamente todas as especificações abaixo
4. A IA deve criar a estrutura completa, arquivos, funcionalidades e preservar tudo conforme descrito

---

## ROLE (Papel da IA)

Você é um desenvolvedor full-stack especialista em sistemas de cardápio digital, pedidos online, checkout e painéis administrativos.

Seu objetivo é recriar com **máxima fidelidade** o projeto "Cardápio Digital" já existente, preservando 100% de sua lógica, fluxos, textos, estrutura e comportamento. Priorize código limpo, vanilla JavaScript, sem dependências desnecessárias, responsivo mobile-first e **totalmente retrocompatível** com o estado atual.

---

## 1. NOME E OBJETIVO DO PROJETO

**Nome do Projeto:** Cardápio Digital

**Objetivo:** Criar um cardápio digital 100% estático, leve e funcional, com fluxo completo de pedidos:

`Visualizar Cardápio → Personalizar Itens (Multi-Ingredientes) → Carrinho → Finalizar Pedido → Gerar Nº do Pedido → Pagamento PIX → Acompanhar Pedido → Painel Admin/Gerenciar Pedidos`

**Tipo de Projeto:** Aplicação Web Estática (HTML + CSS + Vanilla JS + JSON). Sem backend obrigatório. Compatível com hospedagem estática (GitHub Pages, Hostinger, Netlify, Vercel).

---

## 2. STACK TECNOLÓGICA (OBRIGATÓRIA)

- **HTML5** (sem frameworks)
- **CSS3 Puro** (sem Tailwind, Bootstrap, SASS/LESS)
- **Vanilla JavaScript ES6+** (sem jQuery, React, Vue, Angular)
- **JSON** (`cardapio.json`) como fonte única da verdade
- **localStorage** (armazenamento de carrinho e pedidos no navegador)
- **100% estático** – Não utilizar Node.js, npm, build tools ou bundlers desnecessários
- **Compatível com servidor HTTP estático** (necessário para `fetch()` do JSON)

---

## 3. ESTRUTURA DE ARQUIVOS (PRESERVAR EXATAMENTE)

Crie e mantenha esta estrutura EXATA, sem renomear arquivos:

```text
/
├── index.html          # Cardápio + Carrinho + Modal de Personalização
├── acompanhar.html     # Buscar e acompanhar pedido por número
├── admin.html          # Tela de login administrativo
├── gerenciar.html      # Painel para gerenciar pedidos (alterar status)
├── pix.html            # Pagamento PIX (QR Code + código para copiar)
├── cardapio.json       # Catálogo de produtos (Fonte Única da Verdade)
├── planilha.gs         # Google Apps Script (Web App) - MANTER INTACTO
├── README.md           # Documentação
├── DOCS.md             # Documentação
├── melhorias.MD        # Sugestões
├── NumeracaoPedidos.MD # Lógica de numeração de pedidos
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
├── assets/             # Recursos (CSS, JS, imagens)
│   ├── css/
│   │   └── style.css   # Estilos principais
│   ├── js/
│   │   ├── app.js
│   │   ├── planilha.js
│   │   ├── planilha-site.js
│   │   ├── store.js
│   │   └── qrcode.min.js
│   └── img/
├── img/                # Imagens
├── novas_img/          # Imagens
└── tools/              # Utilitários
```

**Regra:** Preservar todos os nomes, caminhos relativos e estrutura original. Não excluir arquivos `.md`, `.txt` ou `.gs` existentes.

---

## 4. DADOS - CARDAPIO.JSON (FONTE ÚNICA DA VERDADE)

O `cardapio.json` DEVE manter EXATAMENTE este formato. Todos os campos de personalização são **opcionais** (retrocompatibilidade total).

### 4.1 Estrutura Base

```json
{
  "categorias": [
    { "id": "lanches", "nome": "LANCHES" },
    { "id": "bebidas", "nome": "BEBIDAS" },
    { "id": "salgados", "nome": "SALGADOS" },
    { "id": "doces", "nome": "DOCES" },
    { "id": "combos", "nome": "COMBOS" }
  ],
  "itens": [
    {
      "id": "x-burger",
      "nome": "X-BURGER",
      "descricao": "Pão, hambúrguer, queijo, alface, tomate.",
      "preco": 15.00,
      "categoria": "lanches",
      "personalizacao": { ... }  // OPCIONAL
    }
  ]
}
```

### 4.2 Sistema de Personalização Multi-Ingredientes (OPÇÃO C)

Implementar **Opção C – Grupos + Remover + Adicionais com Preço**. Estrutura obrigatória:

```json
"personalizacao": {
  "permitir": true,
  "remover": {
    "titulo": "Remover ingredientes",
    "permitir": true,
    "max": 6,
    "opcoes": ["string", ...]
  },
  "adicionais": [
    {
      "titulo": "Adicionais",
      "tipo": "checkbox" | "radio",
      "obrigatorio": false,
      "min": 0,
      "max": 6,
      "opcoes": [
        { "id": "string", "nome": "string", "preco": number }
      ]
    }
  ],
  "observacao": {
    "permitir": true,
    "placeholder": "string"
  }
}
```

**Regras:**
- Campos opcionais. Se `personalizacao.permitir` for `false` ou ausente → comportamento original (+ Adicionar direto)
- `remover`: ingredientes removíveis SEM custo. Não altera preço final
- `adicionais.tipo = "checkbox"`: múltipla escolha (soma todos)
- `adicionais.tipo = "radio"`: escolha única
- `preco` decimal com 2 casas (number)
- IDs em kebab-case, únicos

**Itens com personalização configurada (OBRIGATÓRIO manter):** X-TUDO, X-BACON, X-SALADA, X-FRANGO, X-EGG. Demais itens SEM personalização.

---

## 5. FUNCIONALIDADES OBRIGATÓRIAS

### 5.1 INDEX.HTML (Cardápio + Carrinho + Modal de Personalização)

**Carregamento:**
- Carregar `cardapio.json` via `fetch('./cardapio.json')` – DEVE funcionar via servidor HTTP estático (não apenas file://)
- Agrupar itens por categorias dinamicamente
- Exibir Nome, Descrição, Preço formatado (R$ 0,00)

**Botões dinâmicos:**
- Se item tiver `personalizacao.permitir === true`: Botão **"Personalizar"** (azul)
- Caso contrário: Botão **"+ Adicionar"** (verde) – adiciona direto ao carrinho

**Modal de Personalização (OBRIGATÓRIO):**
- Abrir ao clicar "Personalizar"
- Mostrar: Título do produto + Preço Base
- Seção "Remover ingredientes": checkboxes (sem custo). `max` respeitado
- Seções "Adicionais": renderizar por grupos (checkbox/radio). Respeitar `min/max/obrigatorio`
- Seção "Observações": textarea opcional com placeholder
- **Cálculo em tempo real**: `precoFinal = precoBase + Σ(extras)`. Atualizar total instantaneamente
- Botões: "Cancelar" / "Adicionar ao Carrinho (R$ XX,XX)"
- Fechar ao clicar overlay ou Cancelar

**Carrinho:**
- Lateral/Modal com itens, quantidades, aumentar/diminuir, remover
- Exibir resumo compacto para itens personalizados: `Sem: Alface, Tomate | + Bacon Extra, Ovo Extra`
- Itens com personalização diferente = **IDs únicos separados** no carrinho
- Calcular total geral corretamente
- Botão "Finalizar Pedido" **desabilitado** quando carrinho vazio, **habilitado** com >= 1 item

**Finalizar Pedido:**
- Gerar número único de pedido (sequencial)
- Criar objeto com: `numero`, `itens[]`, `total`, `status`, `data`, `hora`, `timestamp`
- Salvar em `localStorage` (chave `pedidos`)
- Limpar carrinho após sucesso
- Redirecionar para `pix.html?pedido=NUMERO&valor=TOTAL`

**UX:**
- Toast "Item adicionado ao carrinho!" ao adicionar (canto inferior direito, 2.5s)
- Responsivo mobile-first
- Botões com área toque >= 44x44px

### 5.2 ACOMPANHAR.HTML

- Campo "Número do Pedido" + Botão "Buscar"
- Buscar em `localStorage` (array `pedidos`)
- Exibir: Nº Pedido, Itens (com personalização condicional), Total R$ 0,00, Data/Hora, Status
- **Status EXATOS (preservar português):** `Pendente`, `Em Preparo`, `Pronto`, `Entregue` (padrão "Novo"/"Pendente")
- **Exibição condicional de personalização** (SÓ se existir): 
  - `Removidos: ...` (se `removidos.length > 0`)
  - `Adicionais: ... (R$ X,XX)` (se `extras.length > 0`)
  - `Observações: ...` (se `observacao` não vazia)
- Mensagem "Pedido não encontrado" amigável
- Não quebrar pedidos antigos (sem campos novos)

### 5.3 ADMIN.HTML (Login)

- Formulário: Usuário + Senha + Botão Entrar
- Autenticação client-side (Vanilla JS). Manter lógica existente
- Redirecionar para `gerenciar.html` em caso de sucesso
- Erro: "Usuário ou senha inválidos"
- Preservar compatibilidade com credenciais atuais

### 5.4 GERENCIAR.HTML (Painel de Pedidos)

- Listar pedidos do `localStorage` (chave `pedidos`)
- Agrupar por status: Pendentes / Em Preparo / Prontos / Entregues
- Exibir detalhes completos (itens, quantidades, total, nº, data/hora, cliente/endereço se existirem)
- Alterar status entre: `Pendente → Em Preparo → Pronto → Entregue`
- **CONFIRMAÇÃO OBRIGATÓRIA** ao marcar como `Entregue`: `confirm("Tem certeza que deseja marcar este pedido como ENTREGUE?")`
- Demais status SEM confirmação
- Atualizar `localStorage` imediatamente
- **Exibição condicional de personalização** idêntica a acompanhar.html (legível p/ cozinha)
- Preservar pedidos (não excluir automaticamente)

### 5.5 PIX.HTML (Pagamento)

- Ler parâmetros URL: `pedido` e `valor`
- Exibir: "Pedido Nº X", "Valor Total: R$ XX,XX"
- Área QR Code PIX (utilizar `qrcode.min.js` existente)
- Área "Código PIX" (copia-e-cola)
- Botão "Copiar Código PIX" com feedback de sucesso
- Instruções de pagamento
- Manter estrutura para chave PIX/EMV

---

## 6. ESTRUTURA DE DADOS NO LOCALSTORAGE

### 6.1 Carrinho (Variação Personalizada)

Gerar ID único por personalização:

```js
const varId = `${produtoId}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
```

Estrutura do item:

```js
{
  id: "x-tudo_1728331200000_x9k4",
  produtoId: "x-tudo",
  nome: "X-TUDO",
  precoBase: 25.00,
  precoFinal: 30.00,
  quantidade: 1,
  extras: [
    { "nome": "Bacon Extra", "preco": 3.00, "qtd": 1 }
  ],
  removidos: ["Alface", "Tomate"],
  observacao: "Sem cebola, bem passado",
  resumo: "Sem: Alface, Tomate | + Bacon Extra, Ovo Extra"
}
```

**Regras:** `precoFinal = precoBase + soma extras`. Remoções SEM custo. Variações diferentes DEVEM aparecer separadas.

### 6.2 Pedidos

Salvar mesma estrutura nos itens do pedido. Renderização condicional em acompanhar/gerenciar (só exibe se campos existirem).

---

## 7. GOOGLE APPS SCRIPT (planilha.gs)

Incluir `planilha.gs` **COMPLETO e INTACTO**, com a **correção crítica** já aplicada:

### Correção OBRIGATÓRIA em `aplicarLinksImagem()`

Substituir função por versão robusta que evita erro `setRichTextValues` quando coluna "Link da imagem" está vazia:

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

**Objetivo da correção:** Elimina erro `setRichTextValues (number[])` e resolve aviso `"Alterações não chegaram no servidor"` no salvamento de Configurações (aba `Config`).

Demais funções do `planilha.gs` DEVEM ser mantidas exatamente como estão.

---

## 8. REGRAS DE DESENVOLVIMENTO (CRÍTICAS)

1. **Máxima Fidelidade** – Recriar com comportamento IDÊNTICO ao projeto original. Melhorar UX sem quebrar fluxos existentes.
2. **Retrocompatibilidade 100%** – Campos opcionais em tudo. Pedidos antigos SEMPRE legíveis. Produtos sem personalização inalterados.
3. **Preservar Textos** – Manter TODOS os textos, rótulos, botões, mensagens em **Português Brasil (pt-BR)**. Não traduzir.
4. **Não Quebrar Fluxos** – Fluxo `index → finalizar → pix/acompanhar` DEVE permanecer intacto.
5. **Vanilla Only** – Zero dependências externas (exceto arquivos locais existentes: `qrcode.min.js`).
6. **Compatibilidade HTTP** – `fetch('./cardapio.json')` DEVE funcionar via servidor HTTP estático.
7. **Renderização Condicional** – Em `acompanhar.html` e `gerenciar.html`, exibir personalização APENAS quando houver dados (`removidos/extras/observacao`).
8. **Código Limpo e Consistente** – Seguir padrões, indentação e estilo existentes.
9. **Mobile-First + Responsivo** – Priorizar mobile, funcionar bem em tablet/desktop.
10. **Acessível** – HTML semântico, botões >= 44x44px, contraste adequado.
11. **Conservador** – Não reescrever do zero desnecessariamente. Alterações pontuais e seguras.

---

## 9. MELHORIAS JÁ IMPLEMENTADAS (MANTER)

- **Toast de feedback** ao adicionar item ao carrinho
- **Botão "Finalizar Pedido" desabilitado** com carrinho vazio
- **Confirmação ao marcar como "Entregue"** no gerenciar.html
- **Sistema Multi-Ingredientes (Opção C)** completo: Remover + Adicionais (checkbox/radio) + Observações + Cálculo em tempo real
- **Variações separadas no carrinho** (ID único por personalização)
- **Resumo compacto** automático no carrinho
- **Exibição condicional** em acompanhar/gerenciar (preserva pedidos antigos)
- **Correção crítica** em `planilha.gs` (`aplicarLinksImagem`) para salvamento correto na aba `Config`

---

## 10. DOCUMENTAÇÃO A INCLUIR (OBRIGATÓRIA)

Incluir TODOS os arquivos `.md` e `.txt` listados na estrutura (documentação completa, guias, correções, testes, prompts). Eles fazem parte do projeto e devem ser mantidos.

---

## 11. INSTRUÇÃO DE INÍCIO

**Comece analisando e recriando com MÁXIMA FIDELIDADE.**

Priorize PRESERVAR:
1. Todos os textos originais
2. Todos os fluxos testados e funcionais
3. Lógica JavaScript existente
4. Estrutura e estilos CSS
5. Formato exato do `cardapio.json`
6. Compatibilidade total entre todas as páginas (links, parâmetros URL, chaves localStorage)

**Gere o projeto completo, funcional, responsivo e pronto para hospedagem estática.** Não omita nenhum arquivo. Não quebre nenhuma funcionalidade existente.

**Responda em Português Brasil (pt-BR). Seja conservador e fiel ao projeto original.**