# DOCUMENTAÇÃO COMPLETA - Cardápio Digital
## Implementação: Multi-Ingredientes (Opção C - Grupos + Remover + Adicionais com Preço)

> Data da implementação: 07/10/2026  
> Versão: 2.0 - Com suporte a personalização de ingredientes  
> Status: Implementado, testado e documentado

## 1. VISÃO GERAL

Este documento descreve de forma completa a implementação da funcionalidade de **personalização de produtos com múltiplos ingredientes** (Opção C), aplicada ao projeto Cardápio Digital.

O objetivo foi adicionar suporte a **adicionais com preço**, **remoção de ingredientes (sem custo)**, **grupos com escolha única (radio) ou múltipla (checkbox)** e **observações livres**, **sem quebrar a compatibilidade retroativa** com o código, JSON e pedidos existentes.

### 1.1 Tecnologias

- HTML5 + CSS3 (Vanilla, sem frameworks)
- JavaScript ES6+ (Vanilla)
- JSON (`cardapio.json`) como fonte única da verdade
- `localStorage` para persistência (carrinho e pedidos)
- Projeto 100% estático

## 2. OBJETIVOS

- Permitir customização de lanches/produtos por cliente
- Cobrar corretamente por adicionais (+R$)
- Permitir retirar ingredientes sem custo
- Exibir personalização clara no carrinho, acompanhamento e painel de gerenciamento (cozinha)
- **Manter 100% de retrocompatibilidade**: produtos sem configuração continuam iguais, pedidos antigos continuam legíveis
- Não introduzir dependências externas
- Manter fluxo existente intacto (index → finalizar → pix/acompanhar)

## 3. DECISÃO DE ARQUITETURA (OPÇÃO C)

Foram analisadas 3 abordagens. Foi escolhida **Opção C – Híbrida (Grupos + Remover + Adicionais com Preço)** por melhor equilíbrio entre:

- Simplicidade x Flexibilidade
- UX x Clareza para cozinha
- Escalabilidade x Baixo impacto
- Retrocompatibilidade

### Características da Opção C

- **Backward compatible**: Campos opcionais. Se `personalizacao` não existir, comportamento original.
- **Remover ingredientes**: Lista configurável (sem custo).
- **Adicionais por grupos**: Suporta `checkbox` (múltipla escolha) e `radio` (escolha única).
- **Preços por opção**: Cada adicional pode ter `preco > 0`.
- **Observação livre**: Opcional, com placeholder configurável.
- **Cálculo em tempo real**: Atualiza total (base + extras) no modal.
- **Variações separadas**: Cada personalização gera ID único no carrinho.

## 4. MODELO DE DADOS (cardapio.json)

Todos os campos de `personalizacao` são **opcionais**. Estrutura nunca quebra produtos existentes.

### 4.1 Schema completo

```json
{
  "id": "string",
  "nome": "string",
  "descricao": "string",
  "preco": number,
  "categoria": "string",
  "personalizacao": {
    "permitir": boolean,
    "remover": {
      "titulo": "string",
      "permitir": boolean,
      "max": number,
      "opcoes": ["string"]
    },
    "adicionais": [
      {
        "titulo": "string",
        "tipo": "checkbox" | "radio",
        "obrigatorio": boolean,
        "min": number,
        "max": number,
        "opcoes": [
          { "id": "string", "nome": "string", "preco": number }
        ]
      }
    ],
    "observacao": {
      "permitir": boolean,
      "placeholder": "string"
    }
  }
}
```

### 4.2 Significado dos campos

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `personalizacao.permitir` | boolean | Não | `false` | Se `true`, exibe botão "Personalizar". Se ausente/falso, exibe "+ Adicionar" direto. |
| `remover.titulo` | string | Não | "Remover ingredientes" | Título da seção. |
| `remover.permitir` | boolean | Não | `false` | Habilita seção de remoção. |
| `remover.max` | number | Não | Sem limite | Máximo de itens a remover. |
| `remover.opcoes[]` | string[] | Sim (se permitir) | — | Nomes exatos dos ingredientes removíveis. |
| `adicionais[].titulo` | string | Não | "Adicionais" | Título do grupo. |
| `adicionais[].tipo` | "checkbox"|"radio" | Não | "checkbox" | `checkbox`: múltipla escolha. `radio`: escolha única. |
| `adicionais[].obrigatorio` | boolean | Não | `false` | Define se ao menos uma opção deve ser escolhida (não aplicado com validação bloqueante no modal atual). |
| `adicionais[].min` | number | Não | 0 | Mínimo de seleções. |
| `adicionais[].max` | number | Não | Sem limite | Máximo de seleções (útil p/ limitar). |
| `adicionais[].opcoes[].id` | string | Sim | — | ID único da opção (kebab-case). |
| `adicionais[].opcoes[].nome` | string | Sim | — | Nome exibido. |
| `adicionais[].opcoes[].preco` | number | Sim | 0 | Preço extra. `0` = gratuito. |
| `observacao.permitir` | boolean | Não | `false` | Habilita campo de observações. |
| `observacao.placeholder` | string | Não | "" | Texto placeholder do textarea. |

### 4.3 Itens personalizados no cardapio.json (aplicados)

Foram configurados com personalização: **X-TUDO, X-BACON, X-SALADA, X-FRANGO, X-EGG**. Demais produtos sem `personalizacao` (comportamento original).