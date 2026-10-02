# Cardápio Digital

Cardápio online para lanchonete: o cliente navega pelos itens, monta o pedido e envia
tudo pelo WhatsApp, já com o texto formatado. Você edita tudo por uma tela de painel e
publica numa planilha do Google — que é de onde o cardápio do cliente é lido.

Sem framework, sem build, sem servidor. Só HTML, CSS e JavaScript.

## Como abrir

**Opção 1 — por um servidor local** (para testar com a planilha):

```bash
# com Python instalado
python -m http.server 8000

# ou com Node instalado
npx serve .
```

Depois acesse `http://localhost:8000`. O painel fica em `http://localhost:8000/admin.html`.

Para colocar no ar, qualquer hospedagem de site estático serve (Netlify, Vercel,
GitHub Pages, Hostinger, cPanel). Suba a pasta inteira, sem renomear os arquivos.

**Opção 2 — abrindo o arquivo direto** (dois cliques em `index.html`): o cardápio
abre e o WhatsApp funciona, mas a planilha **não** — o navegador bloqueia a leitura e
a escrita em `file://`. Como a planilha é a fonte da verdade, nesse modo o cliente
vê só a cópia antiga que o navegador tinha guardado. Serve para mexer no painel sem
internet, não para divulgar.

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
5. Clique em **⬆ Enviar cardápio agora** — sem publicar, o número novo não chega
   ao cliente

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

Tudo isso vai para a planilha em **Config** quando você clicar em **Enviar cardápio
agora**. O painel salva sozinho, mas o cliente só vê depois de publicar — por isso
existe o aviso em cima das abas.

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

O `cardapio.json` é **backup**, não fonte de verdade: a página do cliente não o busca
mais. O que o cliente vê vem da planilha do Google (ou do que o navegador dele já
tinha guardado, se a planilha não estiver configurada).

## Onde os dados ficam salvos

No navegador de quem está usando, em `localStorage`:

| Chave | O que guarda |
| --- | --- |
| `cardapio:data:v1` | cardápio e configurações (cópia local do que está publicado) |
| `cardapio:carrinho:v1` | carrinho e dados do cliente |
| `cardapio:admin` | hash da senha do painel |
| `cardapio:admin:sessao` | marca de "logado neste navegador" |
| `cardapio:publicado:v1` | digital do cardápio que estava no ar, para avisar o que falta publicar |
| `cardapio:planilha:ultimo` | data do último envio para a planilha |

Isso significa que:

- **A planilha do Google é a fonte da verdade.** Ela manda em tudo: categorias,
  itens, preços, destaques, imagens e os dados da loja.
- O que você edita no painel **não chega ao cliente** até clicar em **Enviar cardápio
  agora**. Enquanto isso, o painel mostra um aviso em cima das abas.
- Cada navegador guarda uma cópia para a página abrir sem esperar a rede. Se a
  planilha falhar, o cliente continua vendo o último cardápio que ele já tinha —
  um cardápio velho é melhor do que uma tela vazia.
- Limpar os dados do navegador apaga a cópia local do painel, mas **não** o que está
  publicado na planilha. Dá para recuperar com **Buscar da planilha**.

Fluxo para publicar mudanças:

```
painel → edite o que quiser  →  ⬆ Enviar cardápio agora  →  cliente vê
```

Alternativa, editando direto no Google Sheets: mexa na planilha e clique em
**⬇ Buscar da planilha** no painel. O painel passa a mostrar o que está no ar.

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
- O `localStorage` do seu navegador guarda a cópia local do cardápio; a planilha do
  Google, se estiver configurada, é a fonte da verdade — não há banco de dados

## Planilha do Google (opcional, mas é ela que manda no cardápio)

A planilha faz duas coisas ao mesmo tempo:

1. **Guarda os pedidos.** Cada pedido vira uma linha em `Pedidos` e uma linha por
   produto em `Itens`.
2. **É a fonte da verdade do cardápio.** Categorias, itens, preços, destaques,
   imagens e até o nome da loja e a cor saem de lá. Quem monta o cardápio que o
   cliente vê é o `index.html`, lendo a planilha.

O cliente continua recebendo o pedido no WhatsApp, então **se algo falhar na
planilha, o pedido não se perde**.

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

> **Atualizou o script?** Volte ao passo 5 e crie uma implantação nova. Alterar o
> código não muda a versão que está no ar — é o erro mais comum aqui.

### 2. Colar a URL no painel

Em **Configurações → Planilha Google Sheets**, cole a URL e clique em
**Testar conexão**. Se aparecer uma linha na aba `Pedidos` com `TESTE`, está
funcionando.

Depois clique em **⬆ Enviar cardápio agora** uma vez. Isso cria a aba `Cardápio`
com as 9 colunas e a aba `Config` com os dados da loja. Sem essa primeira
publicação a planilha fica vazia e o cardápio continua mostrando o exemplo.

O botão **sobrescreve** as abas `Cardápio` e `Config`: elas são o estado atual,
não histórico.

#### Pode colar a URL inteira

Depois que o cardápio abrir, a aba `Registro` passa a guardar a linha completa do
`GET`:

```
https://script.google.com/macros/s/SEU_ID/exec?callback=cardapioLer1&token=SEU_TOKEN
```

Essa linha pode ser colada direto no campo **URL do Web App**. O `?callback=` e o
`?token=` são removidos antes de qualquer chamada e montados de novo, então não
sobra `??` nem token duplicado. Se você colar a URL com o token e deixar o campo
**Token do script** vazio, o token é aproveitado de onde veio — mas **preencha os
dois campos** se puder: deixar o token na URL e no campo é pedir para eles divergirem
sem você perceber.

Só o `/exec` é obrigatório. `SEU_ID` e `SEU_TOKEN` são placeholders: troque pelo
seu.

### O aviso de "não publicado"

O painel compara o que está na tela com o que foi publicado da última vez. Havendo
diferença, aparece um aviso em cima das abas, com um botão que leva direto ao botão
de envio. Ele existe porque o painel salva sozinho e dá a impressão de que
publicou — e não publicou.

A comparação ignora a URL e o token da planilha de propósito: eles nunca vão para a
planilha, e incluí-los faria o aviso nunca se resolver.

### Buscar da planilha

**⬇ Buscar da planilha** relê as abas `Cardápio` e `Config` e troca o que está na
tela. Use quando você mexer direto no Google Sheets — de outro computador, pelo
celular, ou por fórmula.

O painel já faz isso sozinho ao abrir. A única vez que ele **não** troca é quando
você tem alterações locais sem publicar: aí ele avisa o que encontrou e espera você
clicar, e o clique ainda pede confirmação, porque ali sim o trabalho feito à mão
seria descartado.

### O cardápio é montado pela planilha

Ao abrir a página, o `index.html` lê a planilha e monta tudo: as abas de categoria
(com o emoji da coluna `Icone`), os itens, os preços, os destaques, as imagens, o
nome da loja, a cor e o número do WhatsApp.

O caminho é **JSONP**, não um `fetch`: o ContentService do Apps Script não manda
cabeçalhos CORS, então uma leitura comum seria barrada pelo navegador. Com JSONP o
navegador executa um `<script>` de outra origem, e o script responde chamando uma
função que o cardápio criou antes. O preço é que esse texto roda como código na
origem do site — por isso o script recorta o nome do callback para `[A-Za-z0-9_$]`
e exige o mesmo `TOKEN` da escrita.

Detalhes que importam:

- A leitura tem **tempo limite de 8 segundos**. Um Web App publicado errado não
  segura o cardápio em "carregando".
- A página **já aparece** com o que o navegador tinha guardado e troca tudo no
  lugar quando a planilha responde. Se a planilha falhar, o cardápio continua
  aparecendo — um cardápio velho é melhor do que tela vazia.
- **Planilha vazia não apaga o cardápio.** Uma planilha recém-criada ainda sem
  publicação é o estado normal logo depois de configurar a URL.
- Acentos são preservados: `Porções` continua `Porções` na tela, e
  `Batata Cheddar & Bacon` continua com o `&`. Só é removido o que o Sheets
  interpretaria errado — quebra de linha, aspas e `=` no começo da célula.
- Renomear um item muda o `id` dele, e o carrinho de quem estava na página é podado
  para não sobrar item fantasma.
- Preço pode vir como número, `18,90` ou `R$ 1.234,56`; sim/não pode vir escrito à
  mão. Os dois lados convertem do mesmo jeito.
- Link de imagem só entra se for `http://` ou `https://`, sem espaço, aspas ou
  barra invertida. `javascript:` e caminho relativo são descartados.

### O que aparece na planilha

| Aba | Conteúdo | Como escreve |
| --- | --- | --- |
| `Pedidos` | uma linha por pedido | acrescenta no fim |
| `Itens` | uma linha por item pedido | acrescenta no fim |
| `Cardápio` | uma linha por item do cardápio | substitui tudo |
| `Config` | uma linha por configuração da loja | substitui tudo |
| `Registro` | histórico de cada chamada | acrescenta no fim |

#### Aba `Cardápio`

| Coluna | Conteúdo |
| --- | --- |
| `Categoria` | nome do grupo |
| `Icone` | emoji da categoria |
| `Item` | nome do produto |
| `Preco` | preço, como número |
| `Destaque` | `Sim` ou `Nao` |
| `Disponivel` | `Sim` ou `Nao` |
| `Descricao` | texto do produto |
| `Link da imagem` | endereço da foto, **clicável** |
| `Atualizado` | data e hora da última publicação |

A coluna `Icone` se repete em todas as linhas da categoria e vale a primeira que
estiver preenchida — assim dá para corrigir o emoji em qualquer linha, sem mesclar
células (que quebrariam a leitura).

Editar essas colunas direto no Google muda a tela do cliente no próximo
carregamento, **sem passar pelo painel**. É o caminho mais curto para corrigir um
preço correndo.

#### Aba `Config`

Duas colunas, `Chave` e `Valor`, com uma linha por configuração:

`nome`, `descricao`, `whatsapp`, `mensagemAbertura`, `corPrimaria`,
`simboloMoeda`, `taxaEntrega`, `pedidoMinimo`, `aberto`, `mensagemFechado`,
`pedirNome`, `pedirEntrega`.

No fim há uma linha `publicado_em`, que é só um comentário de quando foi a última
publicação. `taxaEntrega` e `pedidoMinimo` saem formatados em R$.

`planilhaUrl` e `planilhaToken` **não** vão para a planilha: a URL diz onde ler, e
pedir isso à planilha seria circular. Elas ficam só no navegador.

#### Aba `Pedidos`

Tem colunas fixas (data, cliente, tipo, endereço, pagamento, totais). Os itens ficam
na coluna **Itens do pedido** e também na aba `Itens`, uma linha por produto — é essa
aba que permite saber quanto saiu de cada item:

```
=SOMASE(Itens!E:E;"X-Burguer";Itens!G:G)
```

### Token (recomendado)

Qualquer pessoa com a URL consegue ler e escrever na sua planilha. Para limitar,
edite a linha `var TOKEN = ''` no script, coloque um valor difícil de adivinhar e
repita o mesmo valor no campo **Token do script** do painel. Se os dois lados não
baterem, o script recusa e anota `token inválido` na aba `Registro`.

Com a planilha virando fonte da verdade, o token é ainda mais importante: ele
protege o cardápio do cliente, e não só os pedidos. Quem tem acesso ao arquivo do
Google continua podendo ler e apagar a planilha.

### Limites que valem saber

- O envio é `POST` com `mode: 'no-cors'`, porque o Apps Script não devolve cabeçalhos
  CORS. Isso significa que o navegador **não consegue ler a resposta**: se a URL
  estiver errada, o botão de teste só avisa que a chamada saiu. Quem confirma a
  gravação é a aba `Registro` do script. Já a **leitura** volta por JSONP e responde
  na tela de verdade.
- Free do Google: 20 mil células por dia numa conta, bem acima do volume de uma
  lanchonete. O limite real costuma ser o do próprio navegador.
- **`file://` não funciona com planilha nenhuma.** Abrir a pasta com dois cliques
  bloqueia tanto a leitura quanto a escrita — e, como a planilha é a fonte da
  verdade, o cliente veria sempre a cópia antiga. **Publique em algum lugar com
  `http://` ou `https://`.** Só nesse caso o cardápio online vale o trabalho.
- A planilha grava os dados que o cliente digita (nome, endereço, pagamento).
  Sai da sua máquina e vai para uma conta do Google: vale avisar na descrição do
  cardápio que as informações são usadas para o pedido.

## Estrutura

```
cardapio/
├── index.html            cardápio do cliente
├── admin.html            painel do dono
├── cardapio.json         exemplo embutido / backup — a página não o busca mais
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
onde módulos seriam bloqueados pelo navegador. Não há `await`/`async` pelo mesmo
motivo: WebView antiga de Android não reconhece.

O cardápio que o cliente vê é montado em três tempos: `store.js` monta na hora
(com o que o navegador tinha guardado), `app.js` pinta, e só então `planilha.js`
traz a versão publicada e a tela se repinta. Por isso a abertura nunca fica
esperando o Google.

## Antes de divulgar

1. Troque o WhatsApp do exemplo pelo número real
2. Troque a senha do painel
3. Publique o `planilha.gs` no Google, cole a URL em Configurações e clique uma vez
   em **Enviar cardápio agora** — é isso que faz o cardápio do cliente vir da planilha
4. **Publique o site em `http://` ou `https://`.** Em `file://` nem a leitura nem a
   escrita da planilha funcionam
5. Abra o link no celular e faça um pedido de teste de ponta a ponta
