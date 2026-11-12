# Novo perfil: Direção (somente leitura, todas as escolas)

## O que a Direção poderá fazer

- Entrar no portal como um perfil próprio, chamado **Direção**, sem precisar escolher unidade: ela enxerga **todas as escolas** automaticamente.
- Ver e usar todos os filtros de: Início, Lista de cadastros, CRM (Pipeline, Funil, Tarefas, Motivos) e Central de Arquivos (Conecta e Interactivo).
- Imprimir fichas e baixar arquivos da Central de Arquivos.

## O que a Direção não poderá fazer

- Nada de alterar: sem marcar Matrícula, sem editar Atendimento/Apresentação/Efetivação, sem arrastar cartões no Pipeline, sem concluir/criar tarefas, sem dar ganho ou perda, sem excluir cadastros, sem enviar arquivos ou links, sem excluir arquivos.
- O menu **Configurações** (Formulários, Templates, Escolas, Usuários) não aparece para esse perfil.
- Botões de ação ficam ocultos ou desativados, e qualquer tentativa de gravação é recusada também no servidor.

## Onde o perfil é criado

Na tela Usuários, "Direção" passa a ser uma opção na lista de perfis. Por ter acesso a tudo, o campo Escola não é pedido para esse perfil. O filtro de perfil da tela de Usuários passa a incluir Direção.

## Detalhes técnicos

Banco (uma migração):

- `alter type app_role add value 'direcao'`.
- Função `public.is_direcao(uuid)` security definer (`exists (select 1 from user_roles where user_id=_uid and role='direcao')`).
- Adicionar `OR public.is_direcao(auth.uid())` às policies de **SELECT** de: `submissions`, `submission_values`, `opportunities`, `crm_tasks`, `funnels`, `funnel_stages`, `presenters`, `forms`, `form_fields`, `print_templates`, `shared_files`, `file_categories`, `audit_log`, `profiles`, `form_destinations`, `form_destination_rules`, `print_template_library`. (`schools` e `crm_close_reasons` já são `true`.)
- Nenhuma policy de INSERT/UPDATE/DELETE é tocada — assim a Direção fica sem escrita no nível do banco.
- `user_view_brands(uuid)` passa a retornar as duas marcas quando o usuário é Direção (para a Central de Arquivos).

Código:

- `model.ts`: `ROLE_LABELS.direcao = "Direção"`.
- `server.ts`: `Perms` ganha `isDirecao`; `getPerms` preenche a partir de `user_roles`.
- `usuarios.tsx`: tipo `Role` inclui `"direcao"`; `NEEDS_SCHOOL` **não** inclui; filtro de Escola ignora usuários Direção (ou os trata como "todas").
- `_authenticated/route.tsx`: `isDirecao` libera Início, Cadastros, CRM completo (Pipeline, Funil, Tarefas, Motivos) e Central de Arquivos; nunca Configurações; `roleLabel` = "Direção".
- `arquivos.functions.ts` (`getAccess`): Direção → `viewBrands` com as duas marcas, `manageBrands` vazio, todas as escolas.
- Telas em modo leitura quando `isDirecao`: `cadastros.tsx` (checkbox Matrícula e `PersonCell` desativados, sem excluir; Imprimir mantido), `crm/pipeline.tsx` (sem arrastar, sem ganho/perda, sem criar oportunidade/tarefa), `crm/tarefas.tsx` (sem concluir/criar), `crm/funil.tsx` e `crm/motivos.tsx` (só listagem), `CentralArquivos.tsx` (sem card de envio e sem excluir; download e copiar link mantidos).
- Guardas de servidor: em `cadastros.functions.ts`, `pipeline.functions.ts`, `tarefas.functions.ts`, `apresentacao.functions.ts`, `arquivos.functions.ts`, as verificações de escrita continuam exigindo admin/gerente — Direção não passa por elas.

Validação: prettier, tsgo, eslint e `git diff --check`.
