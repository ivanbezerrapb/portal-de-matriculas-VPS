# Organizar permissões e nomes dos perfis

## Os perfis passam a ser 4

| Perfil | O que enxerga |
| --- | --- |
| Administrador | Tudo, como hoje |
| Gerente | Início e Cadastros da escola dele — vê, altera e marca Matrícula. Sem CRM |
| Secretaria | Cadastros da escola dele apenas para imprimir — sem editar, sem Matrícula, sem CRM |
| Central de Informações | Só CRM: Pipeline e Tarefas das escolas atribuídas |

- "Gestor de escola" passa a se chamar **Gerente** e "Operador de impressão" passa a se chamar **Secretaria** em todas as telas. Ninguém perde acesso: os usuários atuais continuam com o mesmo vínculo de escola.
- O perfil "Editor de cadastros" deixa de existir e some da tela de Usuários. Hoje nenhum usuário está com esse perfil, então nada muda na prática.
- **Central de Informações** é um perfil novo: é criado com uma escola, igual aos outros. Move cartões no Pipeline, cria e conclui tarefas, mas não pode marcar ganho/perda nem mexer em cadastros, formulários ou configurações.

## Como o menu fica por perfil

- Administrador: Início, Cadastros, CRM completo, Configurações.
- Gerente: Início, Cadastros.
- Secretaria: Cadastros.
- Central de Informações: CRM (Pipeline e Tarefas).

Se alguém digitar o endereço de uma tela que não pode acessar, é levado de volta para a primeira tela permitida do seu perfil.

## Detalhes técnicos

Banco (uma migração):
- `ALTER TYPE app_role ADD VALUE 'info_center';`
- `opportunities_update` / `opportunities_delete`: incluir escolas do usuário com papel `info_center` (mesma sub-consulta usada hoje para `school_manager`).
- `crm_tasks` insert/update/delete já usam `user_school_ids`, que cobre o novo papel — verificar e ajustar apenas se a policy de insert exigir papel específico.
- Remover `has_role(..., 'submission_editor')` das policies de `forms`, `form_fields`, `print_templates` e `audit_log` (o papel deixa de ser usado). O valor do enum permanece, apenas sem uso.

Aplicação:
- `model.ts`: `ROLE_LABELS` = Administrador / Gerente / Secretaria / Central de Informações; tirar `submission_editor`.
- `server.ts` `getPerms`: manter `managerSchools`, `operatorSchools`; adicionar `infoSchools`; `isEditor` deixa de ser usado nas checagens (cai em favor de `managerSchools`).
- `cadastros.functions.ts` (`updateSubmission`, `setEnrollment`) e `cadastros_.$submissionId.tsx`: permissão = admin ou gerente da escola do cadastro; Secretaria só lê/imprime.
- `crm.pipeline.tsx`: `canClose` = admin apenas (gerente sai do CRM; Central não fecha). Central pode arrastar cartões e usar tarefas.
- `usuarios.tsx`: lista de papéis com os 4 novos; `NEEDS_SCHOOL` inclui `school_manager`, `print_operator`, `info_center`; `usuarios.functions.ts` aceita o novo papel na validação Zod.
- `route.tsx`: montar `navEntries` a partir do perfil (regras da tabela acima) e ajustar o rótulo do rodapé da barra lateral; adicionar redirecionamento no `beforeLoad`/efeito quando a rota atual não é permitida.
