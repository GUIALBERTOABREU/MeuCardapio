/* =========================================================================
   Onde o CLIENTE encontra a planilha.
   -------------------------------------------------------------------------
   Preencha estes dois campos e suba o site de novo. Sem isso, o cardapio
   do cliente mostra o exemplo embutido e nunca le a planilha.

   Endereco: cole aqui a URL /exec do Web App.
   Token:    o mesmo valor que voce pôs em `var TOKEN` no planilha.gs.

   ATENCAO — este arquivo vai junto com o site, entao o valor do token
   fica visivel para qualquer pessoa que abrir o codigo da pagina.
   Isso e aceitavel para a LEITURA: o cardapio e publico de qualquer
   jeito, e o script so devolve o cardapio e os dados da loja por essa
   URL (os pedidos de outros clientes nunca saem por ela).
   Quem digita no painel continua precisando do token, e esse fica
   guardado so no navegador de quem administra.

   Se voce nao usa a planilha, deixe os dois campos vazios: o cardapio
   passa a usar o exemplo embutido e a copia que o navegador ja tinha.
   ========================================================================= */

window.CardapioSite = {
  planilhaUrl: 'https://docs.google.com/spreadsheets/d/1Won9PS67k-Pm1l_qF8X3TNsy2tgcph61IDcsu4a1yJU/edit?usp=sharing',
  planilhaToken: ''
};
