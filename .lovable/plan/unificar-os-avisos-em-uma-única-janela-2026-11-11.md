# Unificar os avisos em uma única janela

## O que muda para a Secretaria/Gerente
- Um só pop-up "Pendências" com duas abas:
  - **Agendamentos sem resposta** (Compareceu / Faltou, matrícula pede quantidade) — com contador.
  - **Visitas sem funil** (escolher funil; responsável preenchido sozinho; fichas com pendência pedagógica continuam de fora) — com contador.
- A janela abre se houver pendência em qualquer uma das abas; a primeira aba com itens fica selecionada.
- Abas vazias mostram "Nada pendente".
- **Lembrar depois** vale para a janela inteira: volta em 1 hora se ainda houver pendências.
- A janela fecha sozinha quando tudo é resolvido.
- Selos vermelhos dos menus Calendário e Lista de Visitantes continuam iguais.

## Detalhes técnicos
- Novo `PendingTasksDialog.tsx` usando `Tabs`, reaproveitando o conteúdo (listas/ações) extraído dos dois diálogos atuais como seções sem `Dialog` próprio.
- Um único controle de adiamento em localStorage (1h), substituindo as duas chaves atuais.
- `_authenticated/route.tsx`: troca os dois componentes pelo novo; remove a lógica de "bloqueio" em sequência.
