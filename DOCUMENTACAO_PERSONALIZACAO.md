# DOCUMENTAÇÃO - Personalização de Multi-Ingredientes (Opção C)

## 1. VISÃO GERAL

Esta documentação foca exclusivamente na implementação **Opção C – Grupos + Remover + Adicionais com Preço** para personalização de produtos.

## 2. CONCEITO

A personalização permite que o cliente:

1. **Remova ingredientes** (sem custo adicional) – Ex.: "Sem Alface, Sem Tomate"
2. **Adicione extras** (com preço) – Ex.: "+ Bacon Extra R$ 3,00, + Ovo Extra R$ 2,00"
3. **Faça observações** específicas – Ex.: "Bem passado, sem cebola"
4. **Veja o preço atualizado em tempo real** – Preço base + soma de adicionais

## 3. ESTRUTURA JSON - EXEMPLO COMPLETO (X-TUDO)

```json
"personalizacao": {
  "permitir": true,
  "remover": {
    "titulo": "Remover ingredientes",
    "permitir": true,
    "max": 6,
    "opcoes": [
      "Alface",
      "Tomate",
      "Batata Palha",
      "Ovo",
      "Bacon",
      "Queijo"
    ]
  },
  "adicionais": [
    {
      "titulo": "Adicionais",
      "tipo": "checkbox",
      "obrigatorio": false,
      "min": 0,
      "max": 6,
      "opcoes": [
        { "id": "bacon-extra", "nome": "Bacon Extra", "preco": 3.00 },
        { "id": "ovo-extra", "nome": "Ovo Extra", "preco": 2.00 },
        { "id": "hamburguer-extra", "nome": "Hambúrguer Extra", "preco": 6.00 },
        { "id": "queijo-extra", "nome": "Queijo Extra", "preco": 2.00 },
        { "id": "batata-extra", "nome": "Batata Palha Extra", "preco": 2.00 },
        { "id": "frango-extra", "nome": "Filé de Frango Extra", "preco": 6.00 }
      ]
    }
  ],
  "observacao": {
    "permitir": true,
    "placeholder": "Ex.: Bem passado, sem cebola, ponto da carne..."
  }
}
```

## 4. TIPOS DE GRUPOS (ADICIONAIS)

### 4.1 Checkbox (Múltipla escolha) – Recomendado para extras

```json
{
  "titulo": "Adicionais",
  "tipo": "checkbox",
  "obrigatorio": false,
  "min": 0,
  "max": 5,
  "opcoes": [...]
}
```

- Cliente pode selecionar **0,1,2,...,N** opções
- Soma preço de **todos** selecionados
- Ideal para: Bacon Extra, Ovo Extra, Queijo Extra

### 4.2 Radio (Escolha única)

```json
{
  "titulo": "Tipo de Pão",
  "tipo": "radio",
  "obrigatorio": false,
  "opcoes": [
    { "id": "pao-trad", "nome": "Pão Tradicional", "preco": 0.00 },
    { "id": "pao-brioche", "nome": "Pão Brioche", "preco": 2.00 },
    { "id": "pao-integral", "nome": "Pão Integral", "preco": 1.00 }
  ]
}
```

- Cliente seleciona **exatamente 1** OU **nenhum** (se não obrigatório)
- Ideal para: variações com diferença de preço (pão, molho, tamanho)

## 5. REMOVER INGREDIENTES

```json
"remover": {
  "titulo": "Remover ingredientes",
  "permitir": true,
  "max": 6,
  "opcoes": ["Alface", "Tomate", "Batata Palha", "Ovo", "Bacon", "Queijo"]
}
```

**Regras importantes:**
- **Sem custo** (preço 0). O valor total **NÃO** é alterado ao remover.
- Aparece no resumo como: `Sem: Alface, Tomate`
- Aparece no pedido (acompanhar/gerenciar) como **"Removidos"**.
- Use nomes exatamente como aparecem no cardápio para evitar confusão na cozinha.

## 6. CÁLCULO DE PREÇO

Fórmula aplicada:

```text
precoFinal = precoBase + Σ (preco de cada adicional selecionado)
```

**Exemplo prático:**
- Preço base X-TUDO: R$ 25,00
- Bacon Extra (R$ 3,00) + Ovo Extra (R$ 2,00) = +R$ 5,00
- **Total: R$ 30,00** (remoções não somam)

Cálculo é feito **em tempo real** no modal (recalculado a cada clique).

## 7. ID ÚNICO POR VARIAÇÃO

Para permitir variações separadas no carrinho:

```js
const varId = `${produtoId}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
```

**Motivo:** Se dois clientes (ou mesmo pedido) quiserem X-TUDO com e sem extras, **devem aparecer separados** no carrinho. Com ID único isso acontece corretamente.

## 8. ESTRUTURA SALVA NO CARRINHO/PEDIDO

Item personalizado salvo com esta estrutura:

```json
{
  "id": "x-tudo_1728331200000_x9k4",
  "produtoId": "x-tudo",
  "nome": "X-TUDO",
  "precoBase": 25.00,
  "precoFinal": 30.00,
  "quantidade": 1,
  "extras": [
    { "nome": "Bacon Extra", "preco": 3.00, "qtd": 1 },
    { "nome": "Ovo Extra", "preco": 2.00, "qtd": 1 }
  ],
  "removidos": ["Alface", "Tomate"],
  "observacao": "Sem cebola, bem passado",
  "resumo": "Sem: Alface, Tomate | + Bacon Extra, Ovo Extra"
}
```

**Campos:**
- `precoBase`: Preço original do produto (referência)
- `precoFinal`: Preço calculado com extras (usado em totais)
- `extras.qtd`: Sempre 1 por opção selecionada (para checkbox/radio individuais)
- `resumo`: String automática gerada para exibição compacta
- `removidos[]`: Array vazio se nada removido
- `extras[]`: Array vazio se nenhum adicional
- `observacao`: String vazia se não preenchida

## 9. EXIBIÇÃO (CARRINHO/ACOMPANHAR/GERENCIAR)

### 9.1 Carrinho (index.html)
Exibe: `Nome do produto + (resumo compacto)` abaixo do nome. Preço mostrado é `precoFinal` x quantidade.

### 9.2 Acompanhar Pedido (acompanhar.html)
Renderiza condicionalmente:
- **Removidos:** Alface, Tomate
- **Adicionais:** Bacon Extra (R$ 3,00), Ovo Extra (R$ 2,00)
- **Observações:** Sem cebola, bem passado

*Só aparece se houver conteúdo (preserva pedidos antigos).*

### 9.3 Gerenciar Pedidos (gerenciar.html)
Mesma exibição, organizada para facilitar visualização da cozinha.

## 10. GUIA PARA ADICIONAR PERSONALIZAÇÃO EM NOVO PRODUTO

Passo a passo simplificado:

### Passo 1: Decidir o que precisa
- Precisa permitir remover? Quais ingredientes?
- Precisa adicionais com preço? Checkbox ou Radio?
- Precisa observação livre?

### Passo 2: Adicionar no cardapio.json

Template mínimo (apenas remover):

```json
"personalizacao": {
  "permitir": true,
  "remover": {
    "permitir": true,
    "opcoes": ["Alface", "Tomate"]
  }
}
```

Template com adicionais:

```json
"personalizacao": {
  "permitir": true,
  "adicionais": [
    {
      "titulo": "Adicionais",
      "tipo": "checkbox",
      "opcoes": [
        { "id": "queijo-extra", "nome": "Queijo Extra", "preco": 2.00 }
      ]
    }
  ]
}
```

Template completo (recomendado p/ lanches):

```json
"personalizacao": {
  "permitir": true,
  "remover": { "permitir": true, "opcoes": ["Alface","Tomate"] },
  "adicionais": [{
    "tipo": "checkbox",
    "opcoes": [
      { "id": "bacon-extra", "nome": "Bacon Extra", "preco": 3.00 }
    ]
  }],
  "observacao": { "permitir": true, "placeholder": "Observações..." }
}
```

### Passo 3: Testar
1. Abrir index.html via servidor HTTP
2. Clicar "Personalizar" no item
3. Testar seleções + cálculo em tempo real
4. Adicionar ao carrinho
5. Finalizar pedido e verificar em acompanhar/gerenciar

## 11. BOAS PRÁTICAS

- **IDs únicos**: Use kebab-case em `adicionais.opcoes[].id` (ex.: `bacon-extra`, `ovo-extra`)
- **Nomes claros**: Em `remover.opcoes` use nomes exatos para evitar dúvidas na cozinha
- **Campos opcionais**: Só inclua seções que vai usar (`remover` opcional, `adicionais` opcional, `observacao` opcional)
- **Limitar max**: Em grupos com muitos itens, use `max` para não sobrecarregar UI
- **Retrocompatibilidade**: Nunca torne `personalizacao` obrigatório. Sempre verificar existência no JS
- **Preço com 2 casas decimais**: Seguir padrão (15.00, 3.00)

## 12. DICAS RÁPIDAS

| Caso de uso | Sugestão |
|---|---|
| Só permitir tirar ingredientes | Usar apenas `remover.permitir: true` |
| Só cobrar extras | Usar apenas `adicionais` |
| Escolha única com acréscimo | Usar `tipo: "radio"` |
| Múltiplos extras livres | Usar `tipo: "checkbox"` + `max` adequado |
| Texto personalizado | Usar `observacao.permitir: true` (fallback universal)