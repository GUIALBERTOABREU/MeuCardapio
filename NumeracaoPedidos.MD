# Análise da Numeração de Pedidos — Cardápio Digital

## Visão Geral

O sistema gera números de pedido no formato **DDMM-SSS** (dia+mês + 3 dígitos aleatórios de 100 a 999), resultando em **900 combinações possíveis por dia**. O número é gerado **uma única vez** no momento do envio e reaproveitado tanto na mensagem do WhatsApp quanto na gravação na planilha Google Sheets.

---

## Como a Numeração é Gerada

### Função Base (`app.js` — linha 1328-1333)

```javascript
function numeroPedido() {
  var agora = new Date();
  var dia = String(agora.getDate()).padStart(2, '0') + String(agora.getMonth() + 1).padStart(2, '0');
  var sufixo = String(Math.floor(Math.random() * 900) + 100);
  return dia + '-' + sufixo;
}
```

- **Prefixo (DDMM)**: Dia e mês atuais (ex.: `0510` para 5 de outubro).
- **Sufixo (SSS)**: Número aleatório entre 100 e 999 (900 possibilidades).
- **Exemplo**: `0510-472`.

---

## Problema de Colisão (Paradoxo do Aniversário)

Com 900 combinações/dia, a probabilidade de repetição cresce rápido:

| Pedidos no dia | Chance de pelo menos 1 repetição |
|----------------|----------------------------------|
| 10             | ~5%                              |
| 30             | ~40%                             |
| 50             | ~75%                             |
| 100            | ~99,6%                           |

Se dois pedidos recebem o mesmo número:
- O cliente acompanha o status do pedido **do outro cliente**.
- O operador altera o status na **linha errada** da planilha.

---

## Estratégia Anti-Colisão: "Número do Pedido sem Colisão"

Implementada em `app.js` (linhas 1356–1390). A verificação roda **em segundo plano** enquanto o cliente escolhe os itens.

### Fluxo

1. **Gatilho**: Assim que o carrinho ganha o primeiro item (`renderBotaoCarrinho`, linha 572), chama `reservarNumero()`.
2. **Verificação assíncrona** (`numeroLivre`):
   - Gera um número candidato com `numeroPedido()`.
   - Consulta a planilha via `CardapioPlanilha.statusDoPedido(candidato)`.
   - Se a planilha responde **e** o número já existe (`encontrado === true`), tenta outro (até 5 tentativas por padrão).
   - Qualquer falha de rede/timeout/planilha indisponível **libera o número** (prefere gravar com risco de colisão a não gravar).
3. **Reserva**: O número livre encontrado fica em `numeroReservado`.
4. **Uso no envio** (`enviarWhatsApp`, linha 1472):
   ```javascript
   pedidoAtual = numeroReservado || numeroPedido();
   numeroReservado = ''; // gasta a reserva — vale só para este pedido
   ```
5. **Gravação na planilha** (`registrarPlanilha`, linha 1533): usa o mesmo `pedidoAtual`.

### Código-chave

```javascript
function numeroLivre(restam) {
  var faltam = restam == null ? 5 : restam;
  var tentativa = numeroPedido();

  if (!P || !P.configurada() || faltam <= 0) return Promise.resolve(tentativa);

  return P.statusDoPedido(tentativa).then(function (r) {
    // Só reprova se a planilha respondeu E achou o número
    if (r && r.ok === true && r.encontrado === true) return numeroLivre(faltam - 1);
    return tentativa;
  }, function () {
    // Erro de rede/timeout → libera o número
    return tentativa;
  });
}

function reservarNumero() {
  if (numeroReservado || reservandoNumero) return;
  reservandoNumero = true;
  numeroLivre().then(function (livre) {
    reservandoNumero = false;
    if (livre) numeroReservado = livre;
  }, function () {
    reservandoNumero = false;
  });
}
```

---

## Lado do Servidor (`planilha.gs`)

- A planilha **não gera** o número; ela **recebe** o número enviado pelo cliente (`spec.pedido` / `p.pedido`).
- A aba `Pedidos` tem coluna `Pedido` (cabeçalho fixo).
- Leitura de status (`lerStatusPedido`) e alteração (`alterarStatusPedido`) buscam **da última linha para a primeira** — se houver duplicata, **vale a mais recente** (comentário no código: "se o mesmo número aparecer duas vezes (reimpressão), vale o mais recente").

---

## Pontos de Atenção / Limitações

| Item | Detalhe |
|------|---------|
| **Máximo de tentativas** | 5 por reserva (hardcoded em `numeroLivre`). Em dia de pico extremo (>500 pedidos), pode não achar número livre nas 5 tentativas e cair no número aleatório simples. |
| **Falha silenciosa** | Se a planilha estiver fora do ar ou demorar >8s (timeout do `statusDoPedido`), o número é aceito sem verificação. |
| **Concorrência real** | Dois clientes abrindo o site **quase no mesmo segundo** podem ambos reservar o mesmo número antes que um grave na planilha. A janela de corrida existe, mas é curta (o número é "gasto" no `enviarWhatsApp`). |
| **Mudança de dia** | À meia-noite o prefixo muda; números do dia anterior não colidem com os do dia novo. |
| **Persistência** | `numeroReservado` fica só em memória (variável do módulo). Se o cliente recarregar a página antes de enviar, a reserva se perde e um novo número será sorteado/verificado. |
| **Token** | A verificação usa `statusDoPedido` que **exige token** (o `doGet` do Apps Script cobra token quando `parametro.pedido` existe). O token vem de `planilha-site.js` (visível no front-end). |

---

## Como Testar / Validar

1. Abra o console do navegador na página do cardápio.
2. Adicione um item ao carrinho → verifique `numeroReservado` no console (variável privada, mas pode expor temporariamente com `window.numeroReservado = numeroReservado` no código).
3. Simule colisão: na planilha, crie uma linha na aba `Pedidos` com `Pedido = 0510-472` (hoje). Recarregue o cardápio, adicione item → o sistema deve sortear outro número.
4. Desligue a internet / coloque URL inválida na `planilha-site.js` → o sistema deve aceitar o primeiro número sorteado (fallback de rede).

---

## Possíveis Melhorias Futuras

1. **Aumentar espaço de chaves**: usar 4 dígitos (DDMM-SSSS → 9.000/dia) ou adicionar hora/minuto (DDMMHHMM-SS).
2. **Persistir reserva no `localStorage`** para sobreviver a recarregamento acidental.
3. **Verificação no servidor**: o `doPost` do Apps Script poderia recusar `Pedido` duplicado no mesmo dia e devolver erro; o cliente trataria e tentaria outro número (requer mudar `postar` para `cors` no envio do pedido).
4. **Contador sequencial por dia** na própria planilha (fórmula `=MAX(FILTER(...)) + 1`) — elimina colisão por completo, mas exige que o script leia o último número antes de gravar (race condition residual se duas execuções simultâneas lerem o mesmo máximo).

---

## Resumo

| Camada | Responsabilidade |
|--------|------------------|
| **Cliente (`app.js`)** | Gera `DDMM-SSS`, reserva número livre consultando a planilha em background, usa o reservado no WhatsApp e na gravação. |
| **Servidor (`planilha.gs`)** | Apenas recebe e grava o número; leituras (`lerStatusPedido`, `alterarStatusPedido`) priorizam a última ocorrência em caso de duplicata. |
| **Proteção** | Verificação assíncrona com fallback tolerante a falhas (rede/timeout → aceita). Janela de corrida residual entre reserva e gravação. |

O desenho atual equilibra **simplicidade** (sem lock distribuído, sem depender de resposta do POST no-cors) e **robustez prática** (colisão rara em volumes normais, fallback seguro).