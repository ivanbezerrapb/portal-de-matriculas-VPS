# Editar Crianças e Série na lista

## O que muda
- Na Lista de Visitantes (e na de LEADS, na coluna Série), clicar no número de **Crianças** ou na **Série** abre a janela **"Crianças e séries"**.
- A janela tem só:
  - **Quantidade de crianças** (1 a 10);
  - uma lista de **Série** para cada criança (1 criança = 1 série, 3 crianças = 3 séries), usando as mesmas opções de série do formulário daquele cadastro.
- Todas as séries são obrigatórias para salvar. Nome, nascimento e turno que já existam são mantidos; ao diminuir a quantidade, as últimas crianças são removidas.
- Ao salvar, a lista, o cartão do CRM (Série) e os indicadores do Início passam a usar os novos valores. A mudança fica registrada no histórico do cadastro e no Log de Registro.

## Quem pode
Administrador e Gerente da própria unidade. Os demais perfis continuam só vendo os valores (sem clique).

## Detalhes técnicos
- Nova server fn `updateSubmissionChildren({ submission_id, series: string[] })` em `cadastros.functions.ts`: valida Admin ou `managerSchools` inclui a escola; localiza o campo `children` do formulário (erro "Este formulário não tem campo de crianças" se não houver); lê o JSON atual, ajusta para `series.length` itens preservando nome/nascimento/turno, grava em `submission_values` (upsert, part ''), atualiza `submissions.children_count` e insere em `audit_log` (antes/depois).
- `listSubmissions` passa a devolver as opções de série do campo children por formulário (via `splitChildOptions`) e `can_edit_children`.
- `SubmissionsList.tsx`: células Crianças/Série viram botão quando `can_edit_children`; novo diálogo com campo numérico + selects; invalida `["submissions"]`, `["pipeline"]`.
