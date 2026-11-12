# Nome do cliente nos cartões para todos os perfis

## Problema
O título do cartão (ID + Nome) e a Série só aparecem para o Administrador. Para os demais perfis (Gerente, Secretaria, Central de Informações, Direção) o cartão mostra só o ID, porque as respostas do formulário não podem ser lidas por esses perfis.

## O que muda
- Todos que já conseguem ver o cartão no Pipeline passam a ver o nome do cliente e as séries.
- O acesso aos cartões continua igual: cada perfil só vê os funis e unidades que já vê hoje. Nenhum outro dado é exposto.

## Detalhes técnicos
- `src/lib/ext/pipeline.functions.ts` (`listPipeline`): manter a leitura das oportunidades com `context.supabase` (RLS define quais cartões o usuário vê). Trocar apenas as leituras de `form_destinations`, `form_fields` e `submission_values` para `extAdmin()` (import dinâmico dentro do handler), restritas aos `submission_id`/`form_id` das oportunidades já autorizadas — mesmo padrão já usado em `getOpportunityCustomer`.
- Sem mudança no banco nem na tela.
