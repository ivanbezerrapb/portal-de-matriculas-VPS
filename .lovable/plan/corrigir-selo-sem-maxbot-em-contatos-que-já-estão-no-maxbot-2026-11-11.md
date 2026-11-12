# Corrigir selo "Sem Maxbot" em contatos que já estão no Maxbot

## Erro encontrado (confirmado)
- O Ivanildo Farias está no Maxbot Conecta (contato 8644505) — testei a busca pelo telefone e o Maxbot respondeu certo.
- O problema é do portal: ao abrir o card, ele pede ao banco um campo de nome do card que não existe. O banco recusa, a verificação falha por inteiro e a tela mostra "Sem Maxbot" por engano.
- O mesmo erro faz a rotina de 10 em 10 minutos não verificar nenhum card. Por isso nenhum card está vinculado ainda.

## Correção
1. Pedir os campos certos do card e pegar o nome do contato na ficha (campo Nome), não o código do lead (ex.: 1050/CE2027).
2. Atalho para leads importados do Maxbot: o portal já sabe qual contato do Maxbot gerou aquela ficha. Nesse caso o vínculo é imediato, sem buscar pelo telefone e sem risco de cadastrar duplicado.
3. Quando a verificação falhar, mostrar "Erro no Maxbot" (com o motivo ao passar o mouse), nunca "Sem Maxbot".
4. Testar de novo com o Ivanildo e com os outros cards recentes para confirmar que o selo verde aparece.

## Detalhes técnicos
- `opportunities` não tem `display_name` (é `name`). Corrigir em `loadOpp` (`maxbot.functions.ts`) e `syncRecentOpportunities` (`maxbot.server.ts`); `Opp` passa a ter `name`; nome de cadastro vem do campo /nome/i em `submission_values` (fallback `name`).
- Em `ensureOpportunityContact`: antes da busca por telefone, procurar `submission_id` nos valores de `imported` (contactId→submissionId) da conta e vincular direto.
- `MaxbotBadge`: tratar `isError` da query como "Erro no Maxbot".
- Rodar `ensureOpportunityContact` via script para o card 63ec00fe… e conferir o vínculo gravado.
