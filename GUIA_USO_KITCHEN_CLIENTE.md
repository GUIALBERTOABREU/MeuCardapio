# GUIA DE USO - Cliente x Cozinha

Guia prático de uso da funcionalidade de **Multi-Ingredientes (Personalização)**.

## 1. PARA O CLIENTE (Como personalizar o pedido)

### 1.1 Passo a passo

1. Acesse o cardápio ([http://localhost:8085](http://localhost:8085/) ou site publicado)
2. Navegue até a categoria (ex.: **LANCHES**)
3. Produtos com personalização aparecem com botão **"Personalizar"** (azul)
4. Produtos sem personalização aparecem com botão **"+ Adicionar"** (verde) – comportamento tradicional
5. Clique em **"Personalizar"** no produto desejado
6. Configure sua personalização no modal:
   - **Remover ingredientes**: Marque o que deseja **retirar** (sem custo)
   - **Adicionais**: Marque os extras desejados (valor somado em tempo real)
   - **Observações**: Escreva instruções específicas (opcional)
7. Veja o **total atualizado** no rodapé: `"Adicionar ao Carrinho (R$ XX,XX)"`
8. Clique em **"Adicionar ao Carrinho"** para confirmar
9. Continue comprando ou clique em **"Ver Pedido/Finalizar Pedido"**

### 1.2 Dicas para o cliente

- O valor **aumenta apenas com adicionais** marcados. Remover ingredientes **não altera o preço**.
- Ao adicionar personalizações diferentes do mesmo produto, eles aparecem **separados** no carrinho (correto para evitar confusão).
- Use o campo **Observações** para pedidos bem específicos não contemplados nas opções.

## 2. COMO APARECE NO CARRINHO

**Exemplo: X-TUDO personalizado**

Item aparece como:
```text
X-TUDO
Sem: Alface, Tomate | + Bacon Extra, Ovo Extra
R$ 30,00 x1  R$ 30,00
```

- Linha 1: Nome do produto
- Linha 2: **Resumo compacto** com remoções e adicionais
- Linha 3: Preço final x quantidade + subtotal

**Exemplo sem personalização (Misto Quente):**
```text
MISTO QUENTE
R$ 8,00 x1  R$ 8,00
```

Apenas nome + valores (sem resumo). Mantém visual limpo.

## 3. PARA O CLIENTE - Acompanhar Pedido

1. Após finalizar, vá para `acompanhar.html` ou clique para acompanhar
2. Digite o **número do pedido**
3. Clique em **"Buscar"**

**Exemplo de exibição com personalização:**

```text
Pedido Nº 001

Itens:
- X-TUDO (1x) - R$ 30,00
  Removidos: Alface, Tomate
  Adicionais: Bacon Extra (R$ 3,00), Ovo Extra (R$ 2,00)
  Observações: Sem cebola, bem passado

Total: R$ 30,00
Status: Pendente
Data/Hora: 07/10/2026 14:32
```

**Seções aparecem apenas quando existem.** Pedidos antigos (sem personalização) mostram apenas: `- X-TUDO (1x) - R$ 25,00`

## 4. PARA A COZINHA/ADMIN (Gerenciar Pedidos)

1. Acesse `admin.html` → Faça login
2. Redirecionado para `gerenciar.html` (Painel de Gerenciamento)
3. Veja pedidos separados por status: **Pendentes | Em Preparo | Prontos | Entregues**

### 4.1 Como visualizar personalização

Ao visualizar detalhes do pedido, cada item personalizado mostra:

```text
X-TUDO (1x) — R$ 30,00
  • Removidos: Alface, Tomate
  • Adicionais: Bacon Extra (R$ 3,00), Ovo Extra (R$ 2,00)
  • Observações: Sem cebola, bem passado
```

**Importância para cozinha:** Facilita leitura clara do que deve ser feito (retirar X, adicionar Y), evita erros e confusões.

### 4.2 Alterar status

- Pendente → Em Preparo → Pronto → Entregue
- Ao marcar como **Entregue**: Aparece confirmação `"Tem certeza que deseja marcar este pedido como ENTREGUE?"` (evita clique acidental)

## 5. EXEMPLOS PRÁTICOS REAIS

### Exemplo 1: X-TUDO completo personalizado
- **Base:** R$ 25,00
- **Remover:** Alface, Tomate
- **Adicionais:** Bacon Extra (+R$ 3,00), Hambúrguer Extra (+R$ 6,00)
- **Obs:** "Bem passado"
- **Final:** R$ 34,00

**Aparece para cozinha:** Remover Alface/Tomate + Adicionar Bacon Extra + Hambúrguer Extra + Obs

### Exemplo 2: X-BACON com poucos extras
- **Base:** R$ 20,00
- **Remover:** Alface
- **Adicionais:** Bacon Extra (+R$ 3,00), Ovo Extra (+R$ 2,00)
- **Final:** R$ 25,00

### Exemplo 3: Sem personalização (fluxo antigo)
- **X-SALADA** adicionado direto → Sem resumo, preço R$ 18,00. Perfeito, sem alteração.

## 6. DIFERENÇAS ENTRE OS AMBIENTES

| Local | O que mostra | Objetivo |
|---|---|---|
| **Carrinho (index)** | Resumo compacto (`Sem: ... | + ...`) | Revisão rápida antes de finalizar |
| **Acompanhar** | Detalhado por linhas (Removidos, Adicionais, Observações) | Cliente acompanhar exatamente o pedido |
| **Gerenciar (Admin)** | Detalhado organizado | **Cozinha entender com clareza** (crucial p/ produção) |

## 7. REGRAS IMPORTANTES (Para evitar dúvidas)

1. **Remoções = SEM custo** – Nunca somam ao valor
2. **Adicionais = COM custo** – Somente quando preço > 0
3. **Variações separadas** – Personalizações diferentes = itens diferentes no carrinho (correto)
4. **Retrocompatibilidade** – Pedidos feitos antes da atualização aparecem normalmente, **sem seções extras**
5. **Produtos sem personalizar** – Continuam com fluxo 1 clique (+ Adicionar), sem abrir modal

## 8. FLUXO RESUMIDO (Cliente)

```text
Cardápio → Clica "Personalizar" (se tiver) → Modal abre
  ↓
Configura: Remove + Adicionais + Observa
  ↓
Preço atualiza em tempo real
  ↓
"Clique Adicionar ao Carrinho (R$ XX,XX)"
  ↓
Vai pro carrinho → "Finalizar Pedido"
  ↓
Gera pedido → Redireciona p/ PIX/Acompanhar
  ↓
Cozinha vê personalização completa no Gerenciar
```