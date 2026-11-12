# Indicadores da tela Início

Nova tela Início com filtro de escolas e três cards de visitas + crianças por ano.

## Filtro de escolas

- Acima dos indicadores, um seletor onde é possível marcar uma ou várias escolas ao mesmo tempo.
- Sem nenhuma marcada = todas as escolas (padrão).
- Todos os indicadores e a lista por escola reagem imediatamente ao filtro.
- Só aparecem as escolas que o usuário tem permissão de ver.

## Três cards, lado a lado

```text
2027 (2026)            2026 (2025)            2025 (2024)
Visitas: 15            Visitas: —             Visitas: —
Crianças: 23           Crianças: —            Crianças: —
```

- **2027 (2026)**: calculado a partir dos cadastros feitos no ano civil de 2026.
  - Visitas = número de cadastros.
  - Crianças = soma da quantidade de crianças informada nos cadastros; cadastro sem esse dado soma 0.
- **2026 (2025)** e **2025 (2024)**: ficam em branco ("—"), prontos para receber dados depois.
- No celular os cards ficam empilhados.

## Cadastros por escola

Continua abaixo dos cards, respeitando o filtro de escolas e contando apenas os cadastros do ano vigente (2026).

## Detalhes técnicos

- `src/lib/ext/cadastros.functions.ts`: `getDashboardStats` passa a aceitar `{ schoolIds?: string[] }` e retorna `{ visits, children, bySchool }` do ano civil corrente. Visitas via contagem de `submissions` filtradas por `created_at` no intervalo do ano e `school_id in schoolIds` quando informado; crianças somando `submission_values.value_number` das linhas do campo interno `CHILDREN_COUNT_LABEL` (`part = ''`) dos cadastros do conjunto.
- `src/routes/_authenticated/dashboard.tsx`: estado local de escolas selecionadas, query `listSchools` para o seletor, `queryKey` incluindo as escolas, grid de 3 cards e lista por escola. Anos anteriores renderizados com valores nulos.
- Sem mudança de banco, permissões ou rotas.
