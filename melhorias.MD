# Prompt para IA — Melhorias na Numeração de Pedidos (Cardápio Digital)

## Contexto do Projeto
Sistema de cardápio digital que grava pedidos no Google Sheets via Apps Script. O número do pedido é gerado no cliente (navegador) no formato **DDMM-SSS** (dia/mês + 3 dígitos aleatórios 100–999 = 900 combinações/dia). Existe uma verificação assíncrona em background para evitar colisão, mas com limitações conhecidas.

## Objetivo
Propor e implementar melhorias robustas para **eliminar colisões de numeração** mantendo a arquitetura atual (POST no-cors, planilha como fonte da verdade, token visível no front-end).

---

## Melhorias Sugeridas (em ordem de prioridade)

### 1. Aumentar Espaço de Chaves (Baixo Esforço, Alto Impacto)
**Alterar sufixo de 3 para 4 dígitos** (DDMM-SSSS → 9.000 combinações/dia).
- Probabilidade de colisão com 100 pedidos cai de ~99,6% para ~0,5%.
- Mudança pontual em `app.js::numeroPedido()` e validação no servidor.

### 2. Contador Sequencial por Dia na Planilha (Médio Esforço, Elimina Colisão)
**Ideia**: A planilha mantém o último número usado hoje; o cliente pede "próximo número" via `doGet`/`doPost` antes de gravar.

**Implementação sugerida**:
- Nova ação no `doPost`: `acao: 'proximoNumero'` → retorna `{ proximo: '0510-0042' }`.
- No `planilha.gs`: fórmula ou script que busca `MAX(FILTER(Pedidos, LEFT(Pedido,4)='0510'))` e incrementa.
- Cliente chama **uma vez** ao abrir carrinho (ou no 1º item), guarda e usa.
- **Race condition residual**: duas execuções simultâneas do Apps Script podem ler o mesmo máximo. Mitigar com `LockService` do Apps Script (`LockService.getScriptLock().tryLock(5000)`).

### 3. Verificação no Servidor com Recusa Explícita (Alto Esforço, Robusto)
**Mudar o envio do pedido de `no-cors` para `cors`** para ler a resposta do `doPost`.
- `doPost` valida se `Pedido` já existe hoje na aba `Pedidos`.
- Se duplicado: retorna `{ ok: false, erro: 'NUMERO_DUPLICADO', sugerido: '0510-0043' }`.
- Cliente trata o erro, troca `pedidoAtual` pelo sugerido e reenvia (retry automático 1–2x).
- **Requer**: deploy do Web App com CORS habilitado (já é `Access-Control-Allow-Origin: *` no `ContentService`).

### 4. Persistir Reserva no localStorage (Baixo Esforço)
- Salvar `{ numero: '0510-0472', expira: timestamp+10min }` no `localStorage`.
- Ao recarregar página, se reserva válida e carrinho não vazio → reaproveita.
- Limpar após envio bem-sucedido ou expiração.

### 5. Hibrid: Cliente Sugere, Servidor Autoriza (Equilíbrio)
- Cliente gera `DDMM-SSSS` (4 dígitos) + **hash curto do carrinho** (ex.: primeiros 4 chars de SHA-256 dos IDs+qtds) → `0510-4721-A3F2`.
- Servidor verifica só o prefixo `DDMM-####`; se colidir, incrementa o sufixo numérico e devolve o autorizado.
- Mantém legibilidade humana + unicidade prática.

### 6. UUID v7 / ULID como Chave Técnica (Arquitetural)
- Manter `DDMM-SSS` como **número de exibição** (amigável para cliente/operador).
- Adicionar coluna `IdTecnico` (ULID/UUIDv7) nas abas `Pedidos` e `Itens` — chave primária real, única global, ordenável por tempo.
- `alterarStatusPedido` e `lerStatusPedido` passam a aceitar **ambos** (número amigável OU ID técnico).
- Elimina qualquer dependência de unicidade do número amigável.

---

## Critérios de Aceitação para Qualquer Solução
1. **Zero colisão** em cenário de 200+ pedidos/dia com concorrência.
2. **Não quebra** clientes existentes (número amigável continua funcionando).
3. **Não exige** sincronismo forte (rede instável, Web App cold-start).
4. **Mantém** POST no-cors para o envio do pedido (ou migra para cors com fallback).
5. **Auditoria**: toda numeração fica rastreável na aba `Registro`.

---

## Entregáveis Esperados da IA
1. **Código completo** das funções alteradas (`app.js`, `planilha.gs`, `planilha.js` se necessário).
2. **Instruções de deploy** (novas implantações, versões, testes).
3. **Script de migração** para pedidos existentes (se mudar estrutura das abas).
4. **Testes de carga simulados** (ex.: 500 chamadas paralelas ao `proximoNumero`).
5. **Rollback plan** se algo der errado na produção.

---

## Restrições Técnicas
- Apps Script runtime: V8, tempo máximo 30s / execução.
- Quotas: `UrlFetch` 20.000/dia, `LockService` 200 locks simultâneos.
- Planilha: até 50.000 linhas/aba (limite prático ~10k para performance).
- Navegadores alvo: Chrome/Edge/Firefox/Safari últimos 2 anos + WebViews Android 8+.
- **Sem dependências externas** (npm, build step, CDN). Arquivos estáticos puros.

---

## Formato da Resposta
```markdown
## Melhoria Escolhida: [Título]

### Por que esta abordagem
[Justificativa técnica comparada às alternativas]

### Arquivos Alterados
- `assets/js/app.js` — [funções/linhas]
- `planilha.gs` — [funções/linhas]
- `assets/js/planilha.js` — [se houver]

### Código Novo/Modificado
```javascript
// trecho completo, pronto para copiar/colar
```

### Passos de Deploy
1. ...
2. ...

### Como Testar Localmente
- [passos com console, planilha de teste, etc.]

### Riscos & Mitigações
| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| ...   | ...           | ...       |
```

---

## Instrução Final
**Escolha UMA abordagem principal** (recomendo #2 + #4 combinadas: contador sequencial na planilha com LockService + persistência no localStorage) e entregue o pacote completo pronto para produção. Se quiser apresentar alternativa (#6 UUID técnico) como evolução futura, inclua como apêndice.