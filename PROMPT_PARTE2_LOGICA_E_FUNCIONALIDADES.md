# PROMPT PARTE 2 - LÓGICA E FUNCIONALIDADES

Cole **ESTA SEGUNDA PARTE** na IA da Hostinger, **APÓS** ter executado com sucesso a Parte 1.

## INSTRUÇÃO

Agora implemente TODA a lógica e funcionalidades do projeto Cardápio Digital. Basear-se na estrutura criada na Parte 1. Implementar com máxima fidelidade ao projeto original + melhorias já aplicadas.

## 1. OBJETIVO

Implementar completamente:
- Sistema de Personalização Multi-Ingredientes (Modal + Cálculo em Tempo Real)
- Lógica de Carrinho com variações únicas
- Fluxos completos (Cardápio → Carrinho → Finalizar → PIX → Acompanhar)
- Painéis Admin/Gerenciar com exibição condicional
- Melhorias UX (Toast, botão desabilitado, confirmação)
- Toda lógica JavaScript funcional

## 2. IMPLEMENTAR EM INDEX.HTML + APP.JS + STORE.JS

### 2.1 BOTÃO DINÂMICO POR ITEM

Para cada item renderizado:
- Se `item.personalizacao?.permitir === true` → Exibir botão **"Personalizar"** (classe/style azul)
- Senão → Exibir botão **"+ Adicionar"** (verde) → Adiciona direto ao carrinho (comportamento original)

### 2.2 MODAL DE PERSONALIZAÇÃO (OBRIGATÓRIO COMPLETO)

Criar modal com ID/estrutura adequada. Ao clicar "Personalizar":

**Elementos do modal:**
1. Título: Nome do produto
2. Subtítulo: Preço base (R$ XX,XX)
3. **Seção REMOVER INGREDIENTES** – Renderizar apenas se `remover.permitir === true`
   - Título: `remover.titulo` ou "Remover ingredientes"
   - Checkboxes por opção
   - Respeitar `remover.max` (opcional)
4. **Seções ADICIONAIS** – Renderizar cada grupo em `adicionais[]`
   - Título do grupo
   - Tipo `checkbox`: múltiplas seleções (inputs type=checkbox)
   - Tipo `radio`: escolha única (inputs type=radio, mesmo name por grupo)
   - Exibir nome + preço (R$ X,XX). Preço 0.00 não mostrar "+R$ 0,00"
   - Respeitar `min/max/obrigatorio` quando aplicável
5. **Seção OBSERVAÇÕES** – Se `observacao.permitir === true`
   - Textarea com `placeholder` configurado
6. **Rodapé com TOTAL EM TEMPO REAL**
   - Texto: `Adicionar ao Carrinho (R$ XX,XX)`
   - Atualizar IMEDIATAMENTE ao marcar/desmarcar qualquer opção

**Lógica de Cálculo em Tempo Real:**
```js
precoFinal = precoBase + somaTodosAdicionaisSelecionados
```
- Remoções **NUNCA** alteram o preço
- Recalcular a cada `change/input` (checkbox/radio/textarea não afeta preço)

**Comportamento Modal:**
- Abrir com overlay
- Fechar ao clicar em "Cancelar"
- Fechar ao clicar fora (overlay)
- Prevenir scroll do body enquanto aberto
- Limpar estado ao fechar/cancelar

### 2.3 ADICIONAR ITEM PERSONALIZADO AO CARRINHO

Ao confirmar "Adicionar ao Carrinho":

1. Coletar seleções:
   - `removidos[]`: array com nomes marcados (checkboxes remover)
   - `extras[]`: array de `{nome, preco, qtd: 1}` para cada adicional selecionado
   - `observacao`: string (trim)

2. Gerar ID único por variação:
```js
const varId = `${produtoId}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
```

3. Gerar `resumo` automático:
```text
Sem: Alface, Tomate | + Bacon Extra, Ovo Extra
```
- Só incluir "Sem: ..." se `removidos.length > 0`
- Só incluir "+ ..." se `extras.length > 0`
- Separar com " | " se ambos existirem
- Se nenhum, `resumo = ""`

4. Criar objeto com estrutura exata:
```js
{
  id: varId,
  produtoId,
  nome,
  precoBase,
  precoFinal,
  quantidade: 1,
  extras,
  removidos,
  observacao,
  resumo
}
```

5. Adicionar ao carrinho (localStorage)
6. Fechar modal
7. Exibir **Toast**: `"Item adicionado ao carrinho!"` (canto inferior direito, aparece 2.5s, fade out, remove após)

### 2.4 CARRINHO - MELHORIAS

- Botão "Finalizar Pedido": **desabilitado** (classe `disabled` + `disabled=true`) quando `itens.length === 0`. **Habilitado** quando >= 1 item
- Atualizar estado do botão sempre que carrinho mudar (adicionar/remover/aumentar/diminuir)
- Itens personalizados aparecem com `resumo` abaixo do nome (formato compacto)
- Permitir aumentar/diminuir quantidade e remover normalmente
- Totais calculados com `precoFinal * quantidade`

### 2.5 FINALIZAR PEDIDO

- Gerar número único (sequencial). Manter compatível com lógica existente
- Estrutura do pedido idêntica ao original + itens com campos de personalização
- Salvar em `localStorage` chave `pedidos`
- Limpar carrinho
- Redirecionar: `pix.html?pedido=${numero}&valor=${total}`

## 3. IMPLEMENTAR EM ACOMPANHAR.HTML

Renderizar itens com **EXIBIÇÃO CONDICIONAL** de personalização:

Para cada item do pedido:
```html
- NOME (QTDx) - R$ PRECOFINAL
  (se removidos.length>0) → Removidos: item1, item2
  (se extras.length>0) → Adicionais: Extra1 (R$ 3,00), Extra2 (R$ 2,00)
  (se observacao.trim()) → Observações: texto
```

**REGRA CRÍTICA:** Só exibir seções quando existirem dados. **NUNCA** exibir campos vazios. Isso preserva 100% a legibilidade de pedidos antigos (sem estes campos).

## 4. IMPLEMENTAR EM GERENCIAR.HTML

Idêntica exibição condicional nos cards/detalhes de cada pedido.

**Confirmação ao marcar como ENTREGUE:**
```js
select.addEventListener('change', (e) => {
  const novoStatus = e.target.value;
  if (novoStatus === 'Entregue') {
    if (!confirm('Tem certeza que deseja marcar este pedido como ENTREGUE?')) {
      // Reverter para status anterior
      e.target.value = statusAnterior;
      return;
    }
  }
  // Salvar alteração
  ...
});
```
- Apenas `Entregue` solicita confirmação
- `Pendente/Em Preparo/Pronto` → sem confirmação
- Ao cancelar, reverter valor para status anterior

## 5. IMPLEMENTAR EM APP.JS/STORE.JS - LÓGICA CORE

### 5.1 Funções necessárias

- `abrirModalPersonalizacao(item)` – Montar HTML do modal dinamicamente com base em personalizacao
- `fecharModalPersonalizacao()` – Limpar e ocultar
- `calcularPrecoFinalPersonalizacao()` – Recalcular em tempo real
- `coletarPersonalizacao()` – Pegar seleções
- `gerarResumoPersonalizacao(removidos, extras)` – Gerar string resumo
- `adicionarItemPersonalizado(itemOriginal, personalizacao)` – Adicionar variação única
- `renderizarBotaoItem(item)` – Decidir Personalizar vs Adicionar
- `atualizarEstadoBotaoFinalizar()` – Habilitar/desabilitar conforme carrinho

### 5.2 Toast Component

Criar elemento #toasts (ou usar existente). Função:
```js
function mostrarToast(mensagem, tempo=2500) {
  // Criar toast, adicionar classe show, remover após tempo + fade
}
```

Estilo: canto inferior direito, verde (sucesso), animação suave, z-index alto.

## 6. REGRAS DE IMPLEMENTAÇÃO

1. **Retrocompatibilidade ABSOLUTA** – Verificar sempre `if (item.personalizacao?.permitir)`. Nunca assumir existência.
2. **Preservar código existente** – Não reescrever funções que já funcionam. Estender com condicionais.
3. **Vanilla JS puro** – Sem frameworks. Usar apenas JS nativo.
4. **Renderização condicional estrita** – Em acompanhar/gerenciar, verificar comprimento/trim antes de exibir.
5. **IDs únicos corretos** – Garantir separação de variações no carrinho
6. **Preços sempre com 2 decimais** – Formatar R$ 0,00 corretamente
7. **Responsivo mobile-first** – Modal adaptável a telas pequenas
8. **Sem quebrar fluxo original** – Tudo que funcionava antes DEVE continuar funcionando

## 7. TESTES OBRIGATÓRIOS (VALIDAR)

Após implementação, validar:

- [ ] X-TUDO abre modal "Personalizar", cálculo em tempo real funciona (+extras sobem, remoções não alteram)
- [ ] Variações separadas no carrinho (2 X-TUDO customizados distintos)
- [ ] MISTO QUENTE adiciona DIRETO (sem modal) – comportamento original preservado
- [ ] Carrinho vazio → Botão Finalizar Pedido DESABILITADO
- [ ] Com item → Botão HABILITADO
- [ ] Toast aparece ao adicionar personalizado/direto
- [ ] Acompanhar exibe Removidos/Adicionais/Observações corretamente
- [ ] Gerenciar exibe personalização + confirmação SÓ em "Entregue"
- [ ] Pedido antigo (sem campos novos) aparece normalmente SEM erros
- [ ] Finalizar → PIX com parâmetros corretos

## 8. RESULTADO ESPERADO

Projeto 100% funcional com:
- Modal Multi-Ingredientes completo (Opção C)
- Cálculo em tempo real correto
- Carrinho com variações únicas
- Exibição clara p/ cliente (acompanhar) e cozinha (gerenciar)
- UX melhorada (toast + validações + confirmação)
- **100% retrocompatível** com estado anterior
- Pronto para hospedagem estática

**EXECUTAR ESTA PARTE 2 SOMENTE APÓS PARTE 1 CONCLUÍDA COM SUCESSO. SEJA FIEL, CONSERVADOR E NÃO QUEBRE O QUE JÁ FUNCIONA.**