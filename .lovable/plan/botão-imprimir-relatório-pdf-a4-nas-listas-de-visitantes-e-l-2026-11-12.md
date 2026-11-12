# Botão IMPRIMIR (relatório PDF A4) nas Listas de Visitantes e Leads

## O que muda
- Um botão **Imprimir** no canto superior direito do título "Lista de Visitantes" e do título "Lista de LEADS", onde você marcou na imagem.
- Ao clicar, abre um relatório em folha A4 com **somente os cadastros que aparecem com os filtros atuais** (busca, formulário, datas, funil, pendência, atendimento, série, matrícula, escola), na mesma ordem da tabela.
- A janela de impressão do navegador abre sozinha. Para baixar o arquivo, escolha **Salvar como PDF**.

## Conteúdo do relatório
- Cabeçalho com o logo do Grupo Intereducacional, o nome da lista, a data e a hora da impressão e quem imprimiu.
- Linha com os **filtros aplicados**, por exemplo "Matrícula: Sim · Funil: Todos", e o total de cadastros.
- Tabela com as colunas ID, Responsável, Escola, Crianças, Data, Série, Atendimento, Funil e Matrícula. Os cadastros matriculados ficam em verde, como na tela.
- A tabela sai em folha A4 deitada, para caber todas as colunas. O cabeçalho da tabela se repete em cada página, nenhuma linha fica cortada entre duas páginas, e o rodapé mostra o número da página.

## Detalhes técnicos
- `SubmissionsList.tsx` é usado pelas duas listas. O botão fica ao lado do título e usa `filteredRows` ordenado por `sortRows` com o `sort` atual.
- O relatório fica num bloco escondido na tela e visível só na impressão (`@media print`, `@page { size: A4 landscape; margin: 10mm }`, `thead { display: table-header-group }`, `tr { break-inside: avoid }`, `print-color-adjust: exact`). O restante da página leva `no-print`. Depois a página chama `window.print()`.
- Não há mudança no servidor nem no banco.
