# Central de Informações não vê o Pipeline

## O que está acontecendo (confirmado no banco)

A regra que define "quais unidades um usuário enxerga" foi criada antes do perfil
Central de Informações existir e só considera os perfis Gerente e Secretaria.

Consultei a função `user_school_ids` e ela lista apenas os vínculos com papel
`school_manager` e `print_operator`. O usuário "Central Conecta" tem o vínculo
correto com a unidade Centro (papel `info_center`), e essa unidade tem funil
cadastrado — mas, como o papel não entra na função, a lista de funis volta vazia
e a tela mostra "Nenhum funil disponível".

Isso vale para uma ou várias unidades: nenhuma aparece.

## Correção

Passar a considerar o perfil Central de Informações nas telas do CRM, mantendo-o
fora de Cadastros e Configurações.

- Criar uma regra própria do CRM que inclui Gerente, Secretaria e Central de
  Informações.
- Usar essa regra nas permissões de: funis, etapas do funil, oportunidades e
  tarefas.
- Deixar as permissões de cadastros, formulários e templates como estão, para a
  Central continuar sem acesso a essas telas.
- Permitir que a Central leia apenas o número do cadastro ligado à oportunidade,
  para o cartão continuar mostrando o identificador.

Depois disso, ao entrar com o perfil Central de Informações, o seletor de funil
mostra os funis das unidades vinculadas e o Kanban carrega normalmente.

## Detalhes técnicos

- Nova função `public.user_crm_school_ids(uuid)` (SQL, stable, security definer,
  `search_path = public`) retornando `school_id` de `user_roles` com role em
  (`school_manager`, `print_operator`, `info_center`).
- Recriar as policies `funnels_select`, `funnel_stages_select`,
  `opportunities_select/insert/update/delete` e `crm_tasks_*` trocando
  `user_school_ids` por `user_crm_school_ids`.
- Ajustar `submissions_select` para incluir `user_crm_school_ids` somente onde o
  cartão precisa do `public_id` (ou manter a leitura via `opportunities.details`
  se preferir não abrir cadastros — decisão aplicada: incluir, pois a tela de
  Cadastros já é escondida por perfil).
- Nenhuma mudança necessária em `funis.functions.ts` ou `pipeline.functions.ts`;
  o problema é exclusivamente de permissão no banco.
- Verificação: consultar `funnels` autenticado como o usuário `info_center` e
  abrir o Pipeline no navegador com esse perfil.
