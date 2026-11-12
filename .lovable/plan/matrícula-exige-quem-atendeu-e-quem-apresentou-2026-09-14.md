# Matrícula exige quem atendeu e quem apresentou

## O que muda

Ao marcar a caixinha **Matrícula** na Lista de cadastros, a janela que hoje pergunta só a quantidade passa a pedir também, quando ainda estiverem em branco:

- **Quem atendeu (Secretaria)**
- **Quem apresentou (Coordenação)**

Assim nenhuma ficha fica sem esses dados.

## Como funciona

- A janela mostra: Quantidade de matrículas + os dois campos de nomes.
- Cada campo é a mesma lista suspensa com autocompletar já usada nas colunas da listagem: mostra só os nomes ativos da unidade daquele cadastro e, se o nome ainda não existir, oferece **"Cadastrar «nome»"**.
- Se o cadastro já tiver um dos nomes preenchido, o campo aparece já preenchido e pode ser trocado.
- O botão **Confirmar** só fica disponível com a quantidade válida (inteiro ≥ 1) e os dois nomes informados.
- Ao confirmar: primeiro os nomes são gravados no cadastro, depois a matrícula. Se algo falhar, a janela continua aberta com o aviso do erro.
- Desmarcar a matrícula continua como hoje, sem perguntar nada.
- Os nomes gravados aparecem na hora na listagem, na tela **Apresentação** e nos indicadores da tela Início.

## Técnico

Somente em `src/routes/_authenticated/cadastros.tsx` (sem mudança de banco nem de servidor):

- `enrollmentDialog` passa a guardar também `schoolId`, `attendantName`, `presenterName`.
- Estados locais `dialogAttendant` / `dialogPresenter` (`{ presenter_id?: string; new_name?: string; label: string }`), inicializados com o valor atual da linha.
- Extrair o combobox já existente (`PersonCell`) em um componente reutilizável de seleção (mesma lista filtrada por `school_id` + `kind`, com "Cadastrar «nome»"), usado tanto na célula da tabela quanto dentro da janela; dentro da janela ele não dispara mutação, apenas guarda a escolha.
- No Confirmar: para cada nome alterado/ausente, `await setSubmissionPeople({ data: { submission_id, kind, presenter_id | new_name } })` e em seguida `setEnrollment`; ao final invalidar `submissions`, `presenters`, `pipeline`, `crm-tasks` e `dashboard-stats`.
- Fluxo do CRM (`crm.pipeline.tsx`) fica inalterado — a exigência vale para a marcação feita pela gerente na Lista de cadastros.
