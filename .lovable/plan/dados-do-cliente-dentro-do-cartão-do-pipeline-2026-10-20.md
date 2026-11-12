# Dados do cliente dentro do cartão do Pipeline

Hoje o painel do cartão mostra só o ID e um link "Abrir cadastro", que leva para a tela de Cadastros — tela que a Central de Informações não pode acessar. Por isso o cliente não aparece.

## O que muda
- Ao abrir um cartão que veio de formulário, o painel mostra logo abaixo de "Entrada" uma seção **Dados do cliente** com todas as respostas do formulário, na ordem dos campos: nome, telefone (com ícone do WhatsApp), e-mail, endereço formatado, crianças uma abaixo da outra (nome, nascimento, série, turno) e demais perguntas.
- O link "Abrir cadastro" sai do painel; para Administrador, Gerente e Secretaria fica um link discreto "Ver ficha completa".
- Quem pode ver: todo usuário com acesso ao cartão — Administrador, Direção, Gerente e Secretaria da unidade, e Central de Informações vinculada ao funil do cartão. Somente leitura.
- Vale para Lista de Visitantes e Lista de LEADS, cartões novos e antigos.

## Detalhes técnicos
- Nova server function `getOpportunityCustomer({ opportunity_id })` em `pipeline.functions.ts` (requireAuth): lê a oportunidade com o cliente do usuário (RLS garante o acesso ao cartão); se não houver acesso, erro. Depois busca `submissions`, `form_fields` e `submission_values` via `extAdmin()` apenas para o `submission_id` daquela oportunidade (contorna o bloqueio de RLS de submissions para `info_center` sem abrir a tabela).
- Retorna lista `{label, type, value}` já formatada (reaproveita `parseChildren`, `parseAddress`, tratamento de múltipla escolha).
- `crm.pipeline.tsx`: componente `OpportunityCustomer` com `useQuery(["opp-customer", id])`, substituindo o bloco "Abrir cadastro"; link de ficha completa só quando o perfil tem acesso a Cadastros.
