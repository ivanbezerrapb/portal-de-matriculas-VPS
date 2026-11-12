# Séries completas e quantidade de matrículas efetivadas

## Gráfico Série de interesse

- Mostrar todas as séries retornadas pelos cadastros, sem limitar a lista.
- Manter a ordem decrescente pela quantidade de crianças.
- Exibir o nome completo de cada série, sem reticências.
- Ajustar automaticamente a altura do gráfico conforme a quantidade de séries e reduzir a espessura das barras quando necessário, evitando que respostas fiquem sobrepostas ou ocultas.
- Em nomes muito longos, permitir duas linhas na área do rótulo em vez de cortar o texto.

## Quantidade de matrículas

Cada cadastro poderá registrar quantas crianças realmente foram matriculadas, pois uma visita pode trazer várias crianças e somente parte delas pode efetivar matrícula.

### Pela tela Cadastros

- Ao marcar a opção Matrícula, abrir uma janela perguntando **Quantas matrículas foram efetivadas?**.
- Campo numérico inteiro, obrigatório e maior que zero.
- A quantidade não será limitada ao número de crianças informado, conforme definido.
- Só depois da confirmação o cadastro será marcado como Ativo, as tarefas pendentes serão concluídas e a oportunidade vinculada será marcada como ganha.
- Ao desmarcar a matrícula, zerar a quantidade e reabrir a oportunidade, mantendo as tarefas já concluídas como hoje.
- Mostrar na coluna Matrícula a situação e a quantidade, por exemplo: `Ativo · 2`.

### Pelo CRM

- Ao marcar uma oportunidade vinculada a cadastro como ganha, a janela existente também solicitará a quantidade de matrículas efetivadas.
- O campo será numérico, obrigatório, inteiro e maior que zero.
- A quantidade será gravada no cadastro vinculado junto com a situação de matrícula.
- Oportunidades criadas manualmente, sem cadastro vinculado, continuam podendo ser ganhas, mas não pedem nem contabilizam quantidade de matrículas.
- Marcar como perdida ou reabrir uma oportunidade vinculada zera a quantidade e remove a situação de matrícula.

## Indicador da tela Início

- **Total de matrículas efetivadas** passa a somar as quantidades registradas, não apenas contar cadastros marcados.
- O percentual continua sendo `total de matrículas efetivadas ÷ total de crianças × 100`.
- Todos os valores continuam reagindo ao filtro de escolas e considerando o ano vigente.
- Como a quantidade é livre, o percentual poderá ultrapassar 100% quando os registros informados forem maiores que o total de crianças capturado nos formulários.

## Dados atuais

- Adicionar ao cadastro uma quantidade inteira de matrículas, com valor inicial zero.
- Para cadastros já matriculados, preencher a quantidade com o total de crianças existente.
- Quando um cadastro antigo matriculado não tiver total de crianças, considerar uma matrícula.
- Cadastros ainda não matriculados permanecem com quantidade zero.

## Histórico e segurança

- Registrar no histórico do cadastro a quantidade anterior e a nova quantidade, além da alteração da situação da matrícula.
- Manter as permissões atuais: somente Administrador e Gerente podem efetivar matrículas pela lista; o fechamento pelo CRM continua disponível apenas para quem já tem permissão.
- Validar a quantidade também no servidor para impedir valores vazios, decimais ou menores que um.

## Detalhes técnicos

- Migração: adicionar `submissions.enrollment_count integer NOT NULL DEFAULT 0` com validação para valores não negativos e executar o preenchimento dos dados atuais usando `children_count`, com mínimo de 1 para cadastros matriculados.
- `setEnrollment` passa a receber `enrollment_count` quando `enrolled=true`, grava a quantidade e inclui a mudança no `audit_log`.
- `closeOpportunity` passa a aceitar `enrollment_count` somente para ganhos vinculados a cadastro; as leituras do Pipeline incluem `submissions.children_count` para identificar o vínculo e oferecer contexto na janela.
- `reopenOpportunity` e fechamentos como perda zeram `enrollment_count` no cadastro vinculado.
- A lista de cadastros passa a trazer e exibir `enrollment_count`.
- `getDashboardStats` soma `enrollment_count` dos cadastros filtrados e usa essa soma no percentual.
- O gráfico de séries usa altura calculada pela quantidade de itens e um rótulo personalizado com quebra de linha.
