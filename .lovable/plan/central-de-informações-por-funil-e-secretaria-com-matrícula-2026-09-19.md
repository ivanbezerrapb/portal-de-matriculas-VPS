# Central de Informações por funil e Secretaria com matrícula

## Central de Informações ligada a funis

- Ao criar (ou editar) um usuário com o perfil **Central de Informações**, além da
  unidade, o Administrador escolhe **um ou vários funis** daquela unidade.
- O usuário só enxerga no Pipeline, no Funil e nas Tarefas os funis atribuídos a
  ele — e apenas dentro das unidades a que pertence.
- Cada cartão passa a mostrar o **responsável** (o atendente da Central ligado
  àquele funil), e o Pipeline ganha um filtro **Responsável** para Administrador,
  Direção e Gerente.
- Se o usuário ainda não tiver nenhum funil atribuído, o Pipeline mostra um aviso
  explicando que é preciso pedir a liberação ao Administrador.

## Secretaria

- A Secretaria passa a poder, **somente nas unidades dela**:
  - marcar **Matrícula** (com a janela de quantidade, como a Gerente);
  - preencher **Apresentação, Atendimento e Efetivação**, inclusive cadastrar um
    nome novo na própria unidade.
- Continua **sem** editar os campos do cadastro e **sem** acesso ao CRM.

## Detalhes técnicos

Banco (uma migração no banco externo):

- Nova tabela `public.user_funnels (user_id uuid, funnel_id uuid references
  funnels(id) on delete cascade, primary key (user_id, funnel_id))`, com GRANTs
  para `authenticated`/`service_role`, RLS ligada: SELECT para o próprio usuário,
  admin e direção; INSERT/DELETE só admin.
- Função `public.user_funnel_ids(uuid)` (stable, security definer,
  `search_path = public`) devolvendo os funis do usuário.
- `funnels_select`, `funnel_stages_select`, `opportunities_*` e `crm_tasks_*`:
  manter a regra de unidade e, quando o usuário tem papel `info_center`,
  exigir também que `funnel_id` esteja em `user_funnel_ids(auth.uid())`.
- `submissions_update` e `submission_values_update/insert`: **não mudam** (a
  Secretaria não edita cadastros); a matrícula e os nomes passam pelo servidor
  com cliente privilegiado após a checagem de perfil, ou — preferido — incluir
  `print_operator` apenas nas policies de `presenters` (insert/update) e em um
  policy novo restrito às colunas de matrícula não é possível por coluna, então
  a gravação de matrícula/nomes de Secretaria usa `extAdmin()` após validar a
  unidade no servidor.

Aplicação:

- `server.ts`: `getPerms` passa a devolver `funnelIds: string[]`
  (de `user_funnels`) e mantém `infoSchools`.
- `usuarios.functions.ts`: `createUser`/`setUserRole` aceitam `funnel_ids` quando
  o papel é `info_center`, gravando em `user_funnels`; nova função
  `setUserFunnels`; `listUsers` devolve os funis de cada usuário.
- `usuarios.tsx`: ao escolher Central de Informações, aparece a seleção múltipla
  de funis filtrada pela escola escolhida; o cartão do usuário lista os funis e
  permite alterá-los.
- `funis.functions.ts` (`listFunnels`) e `pipeline.functions.ts`
  (`listPipeline`): para `info_center`, filtrar pelos funis atribuídos.
- `crm.pipeline.tsx`: filtro "Responsável" (lista de usuários `info_center` dos
  funis visíveis) e nome do responsável no cartão.
- `cadastros.functions.ts` (`setEnrollment`) e `apresentacao.functions.ts`
  (`setSubmissionPeople`, `createPresenter`): permitir
  `perms.operatorSchools.includes(submission.school_id)` além de admin/gerente,
  usando `extAdmin()` para a escrita depois da validação.
- `cadastros.tsx`: `canEnroll` e a edição de Apresentação/Atendimento/Efetivação
  passam a considerar `operatorSchools`; a edição dos campos do cadastro continua
  restrita a admin/gerente.

Verificação: consultar `user_funnels` e abrir o Pipeline com um usuário
`info_center` de dois funis; marcar matrícula e nomes com um usuário Secretaria.
