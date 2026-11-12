# Calendário: filtro Unidade com uma unidade por vez

## O que muda
- O filtro **Unidade** do Calendário passa a aceitar só uma unidade por vez.
- Clicar numa unidade seleciona só ela, e a anterior sai da seleção. Clicar de novo na unidade escolhida limpa o filtro, e o Calendário volta a mostrar todas as unidades do usuário.
- O filtro **Situação** continua aceitando várias opções ao mesmo tempo.

## Detalhes técnicos
- `src/routes/_authenticated/calendario.tsx`: `schoolFilter` passa de `string[]` para `string | null`. O clique define o id da unidade, ou `null` se ela já estava selecionada. O filtro dos eventos fica `!schoolFilter || e.school_id === schoolFilter`.
