# Cardápio Digital

Cardápio online para lanchonete: o cliente navega pelos itens, monta o pedido e envia
tudo pelo WhatsApp, já com o texto formatado. Você edita tudo por uma tela de painel e
exporta o cardápio como um arquivo JSON.

Sem framework, sem build, sem servidor. Só HTML, CSS e JavaScript.

## Como abrir

**Opção 1 — direto no navegador (mais simples)**
Dê dois cliques em `index.html`. Funciona abrindo o arquivo local.

**Opção 2 — por um servidor local** (recomendado, evita restrições do navegador com
arquivos locais):

```bash
# com Python instalado
python -m http.server 8000

# ou com Node instalado
npx serve .
```

Depois acesse `http://localhost:8000`. O painel fica em `http://localhost:8000/admin.html`.

Para colocar no ar, qualquer hospedagem de site estático serve (Netlify, Vercel,
GitHub Pages, Hostinger, cPanel). Suba a pasta inteira, sem renomear os arquivos.

## Os dois painéis

| Arquivo | Quem usa | Para que serve |
| --- | --- | --- |
| `index.html` | cliente | Cardápio, busca, carrinho e envio do pedido |
| `admin.html` | dono | Editar itens, preços, categorias e configurações |

## Entrar no painel

Abra `admin.html`. A senha padrão é **`admin`**, e o painel pede para você trocar na
primeira vez que entrar.

A senha fica salva só neste navegador (no `localStorage`, com hash SHA-256). Se você
trocar a senha em um celular, o outro dispositivo continua com a senha antiga — cada
aparelho tem a sua.

Antes de publicar: troque a senha para algo forte e evite deixar o link do painel
divulgado. Um site estático não tem servidor, então qualquer pessoa com a URL e a
senha consegue editar o cardápio. Se quiser travar de vez, dá para colocar o
`admin.html` atrás de uma proteção do próprio hospedador (por exemplo, proteção por
senha de pasta no cPanel, ou Cloudflare Access).

## Mudar o número do WhatsApp — antes de publicar

O cardápio de exemplo vem com o número fictício `5511999999999`. **Troque pelo seu:**

1. Entre no painel (`admin.html`)
2. Aba **Configurações**
3. Campo **WhatsApp (com DDD)**: só números, com código do país e DDD, sem espaços,
   `+` ou traço. Ex.: `5511987654321`
4. Clique em **Salvar**

O mesmo campo aparece para o cliente dentro do carrinho.

## O que dá para configurar

Na aba **Configurações**:

- **Nome e descrição** da lanchonete (vão no título e no rodapé)
- **WhatsApp** que recebe os pedidos
- **Mensagem de abertura** — o texto que antecede o pedido na conversa
- **Mensagem de fechado** — o que o cliente lê quando a loja está fechada
- **Cor da marca** — a página se ajusta sozinha e mantém o texto legível
- **Símbolo da moeda** — `R$`, `$`, `€`…
- **Taxa de entrega** — só vale para entrega; retirada nunca paga taxa
- **Pedido mínimo** — abaixo disso o botão de finalizar fica bloqueado, com aviso
  de quanto falta
- **Loja aberta/fechada** — fechada, o cliente vê o aviso e não consegue adicionar
  itens
- **Pedir nome** e **pedir entrega** — ligam ou desligam esses campos no checkout

## Cadastrar itens

Na aba **Itens e categorias**:

- **+ Nova categoria** cria uma categoria (o nome define o atalho no menu)
- Cada categoria tem **+ Adicionar item**, e cada item tem: nome, descrição,
  preço, foto (por URL), destaque e disponibilidade
- As setas ↑ ↓ mudam a ordem — o menu segue essa mesma ordem
- A lixeira apaga item ou categoria
- Dar o mesmo nome em categorias diferentes é permitido: o sistema gera ids
  diferentes por item para o carrinho não se misturar

Preço aceita `12,50`, `12.50` ou `R$ 12,50`. Item sem preço ou com preço negativo é
recusado na hora.

## Salvar e levar o cardápio para outro lugar

Aba **Arquivo JSON**:

- **Baixar** salva um `cardapio.json` na sua máquina
- **Copiar** leva o conteúdo para a área de transferência
- **Colar e salvar** aplica um JSON colado
- **Atualizar** recarrega o conteúdo atual
- **Restaurar exemplo** apaga as alterações e volta ao cardápio de demonstração
  (pede confirmação)

Se o JSON estiver com erro de escrita, o painel mostra em qual linha está o problema e
**não** apaga o cardápio atual.

O botão **Baixar cardápio (JSON)** no rodapé do `index.html` também deixa o cliente
salvar uma cópia.

## Onde os dados ficam salvos

No navegador de quem está usando, em `localStorage`:

| Chave | O que guarda |
| --- | --- |
| `cardapio:data:v1` | cardápio e configurações |
| `cardapio:carrinho:v1` | carrinho e dados do cliente |
| `cardapio:admin` | hash da senha do painel |
| `cardapio:admin:sessao` | marca de "logado neste navegador" |
| `cardapio:planilha:ultimo` | data do último envio para a planilha |

Isso significa que:

- O cardápio salvo no painel vale **para aquele navegador e naquele aparelho**
- Clientes veem o cardápio pelo arquivo `cardapio.json` do site (versão pública
  do cardápio), não pelo que você salvou no seu navegador
- Limpar os dados do navegador apaga o cardápio salvo no painel
- Se você editar o menu pelo painel e quiser que os clientes vejam a mudança,
  exporte o JSON e suba o arquivo `cardapio.json` no site

Fluxo recomendado para publicar mudanças:

```
painel → Aba JSON → Baixar  →  substitua cardapio.json no site  →  pronto
```

O `cardapio.json` é usado na primeira visita de cada visitante, quando ainda não há
nada salvo no `localStorage` dele.

O painel também atualiza abas abertas: se o cardápio estiver aberto em outra aba do
mesmo navegador, a lista se reorganiza sozinha depois das alterações.

## Como fica o pedido no WhatsApp

O cliente monta o pedido e o botão gera uma conversa já com o texto pronto:

```
*Lanchonete do Zé — PEDIDO*
Pedido #0110-364
*Cliente:* Joao da Silva

*Itens*

1. 2x X-Burguer — R$ 37,80
   _obs: bem passado, sem picles_

*Resumo*
Subtotal: R$ 37,80
Taxa de entrega: R$ 5,00
*TOTAL: R$ 42,80*

*Entrega:* Entrega em Rua das Flores, 120
*Pagamento:* Pix

*Observações:* tocar o interfone
```

O número do pedido é gerado a partir da data e de um contador, para o dono conseguir
diferenciar dois pedidos feitos no mesmo minuto. O cliente revisa tudo antes de
enviar — a mensagem é enviada pelo WhatsApp dele, então o pedido chega como conversa
normal e você responde por lá. Não há API nem custo envolvido.

Cada item do carrinho aceita uma observação própria ("sem cebola", "bem passado"),
que entra na mensagem junto da linha do item.

## Acessibilidade e instalação

Sem dependências, sem requisições externas, sem rastreamento. Lighthouse das duas
páginas, sem falhas:

| | Acessibilidade | Boas práticas | SEO |
| --- | --- | --- | --- |
| `index.html` | 100 | 100 | 100 |
| `admin.html` | 100 | 100 | 100 |

- Todos os textos passam em 4.5:1 (WCAG AA), no tema claro e no escuro
- A cor da marca é escurecida automaticamente quando o branco sobre ela não
  passaria no contraste
- Navegação por teclado, inclusive as setas ← → para trocar de aba no painel
- O tema escuro segue a preferência do sistema
- O `localStorage` do seu navegador é a única memória do app — não há banco de dados

## Planilha do Google (opcional)

Cada pedido pode virar uma linha numa planilha, sem custo e sem chave de API. O
cliente continua recebendo o pedido no WhatsApp — a planilha é só um registro
extra, então **se algo falhar ali, o pedido não se perde**.

O script é o arquivo `planilha.gs`.

### 1. Publicar o script

1. Crie uma planilha no Google Sheets (ela será a planilha de destino).
2. **Extensões → Apps Script** e apague o conteúdo de `Code.gs`.
3. Cole o conteúdo inteiro de `planilha.gs` e salve com Ctrl+S.
4. Clique no ícone ▷ **Executar** na primeira vez e autorize o acesso. Escolha a
   função `doPost` e aceite a tela de permissão.
5. **Implantar → Nova implantação**, tipo **Web app**:
   - *Execute como:* eu mesmo
   - *Quem pode acessar:* **QUALQUER PESSOA**
6. Copie a URL que termina em `/exec`.

O passo 4 não é opcional: o Google só libera a implantação para terceiros depois
do primeiro uso autorizado. Sem ele, o passo 5 não funciona.

### 2. Colar a URL no painel

Em **Configurações → Planilha Google Sheets**, cole a URL e clique em
**Testar conexão**. Se aparecer uma linha na aba `Pedidos` com `TESTE`, está
funcionando.

O botão **Enviar cardápio agora** grava a aba `Cardápio` com o catálogo inteiro.
Ele **sobrescreve** essa aba: ela é o estado atual do cardápio, não histórico.

### O que aparece na planilha

| Aba | Conteúdo | Como escreve |
| --- | --- | --- |
| `Pedidos` | uma linha por pedido | acrescenta no fim |
| `Itens` | uma linha por item pedido | acrescenta no fim |
| `Cardápio` | uma linha por item do cardápio | substitui tudo |
| `Registro` | histórico de cada chamada | acrescenta no fim |

`Pedidos` tem colunas fixas (data, cliente, tipo, endereço, pagamento, totais).
Os itens ficam na coluna **Itens do pedido** e também na aba `Itens`, uma linha por
produto — é essa aba que permite saber quanto saiu de cada item:

```
=SOMASE(Itens!E:E;"X-Burguer";Itens!G:G)
```

### Token (recomendado)

Qualquer pessoa com a URL consegue escrever na sua planilha. Para limitar isso,
edite a linha `var TOKEN = ''` no script, coloque um valor difícil de adivinhar e
repita o mesmo valor no campo **Token do script** do painel. Se os dois lados não
baterem, o script recusa e anota `token inválido` na aba `Registro`.

O token protege contra quem achou a URL. Quem tem acesso ao arquivo do Google
continua podendo ler e apagar a planilha.

### Limites que valem saber

- O envio é `POST` com `mode: 'no-cors'`, porque o Apps Script não devolve cabeçalhos
  CORS. Isso significa que o navegador **não consegue ler a resposta**: se a URL
  estiver errada, o botão de teste só avisa que a chamada saiu. Quem confirma a
  gravação é a aba `Registro` do script.
- Free do Google: 20 mil células por dia numa conta, bem acima do volume de uma
  lanchonete. O limite real costuma ser o do próprio navegador.
- Se o cardápio for aberto direto do `file://` (dois cliques), o envio para a
  planilha **não funciona** — o navegador bloqueia a chamada. Publique em algum
  lugar com `http://` para isso passar a valer.
- A planilha grava os dados que o cliente digita (nome, endereço, pagamento).
  Sai da sua máquina e vai para uma conta do Google: vale avisar na descrição do
  cardápio que as informações são usadas para o pedido.

## Estrutura

```
cardapio/
├── index.html            cardápio do cliente
├── admin.html            painel do dono
├── cardapio.json         cardápio de exemplo (versão pública)
├── planilha.gs           script do Google Sheets (cole no Google, não no site)
└── assets/
    ├── css/style.css     todo o estilo, com variáveis de cor
    └── js/
        ├── store.js      dados, validação, salvar/carregar, senha
        ├── planilha.js   envio de pedidos e cardápio para o Google Sheets
        ├── app.js        cardápio, busca, carrinho, mensagem do WhatsApp
        └── admin.js      painel: itens, categorias, config, planilha, JSON
```

`store.js` precisa vir antes dos outros: é ele que guarda os dados. `planilha.js` vem
entre `store.js` e `app.js`/`admin.js` porque usa `Store.dados()`. Os scripts são
comuns (sem `type="module"`) justamente para o cardápio funcionar aberto do `file://`,
onde módulos seriam bloqueados pelo navegador.

## Antes de divulgar

1. Troque o WhatsApp do exemplo pelo número real
2. Troque a senha do painel
3. Exporte o JSON e suba o `cardapio.json` no site
4. Se quiser a planilha: publique o `planilha.gs` e cole a URL em Configurações
5. Abra o link no celular e faça um pedido de teste de ponta a ponta
