# Corrigir "Quem mais atendeu" com os responsáveis atuais dos funis

## O que a varredura encontrou
Revisei os 45 cadastros que têm Atendimento preenchido. Comparei cada um com o responsável atual do funil em que o cadastro está.
- **Cristo:** todos corretos (LAURA MARIA, ETHELBURGA, Josy Rodrigues, RENATA MARINHO).
- **Centro:** 3 cadastros com problema:
  - 2 aparecem como "ANA CLAUDIA NUNES MARTINS", que é o nome antigo. O funil "Centro - Pós Visita (Infantil e Fund I)" tem como responsável **ANA CLAUDIA**.
  - 1 aparece como "Fabiana Grisi" (usuária excluída). O funil "Centro - Pós Visita (Fund II e Médio)" tem como responsável **ALICE FABIANA**, e o cartão não tem dono.
- Bessa e Expedicionários: nenhum Atendimento registrado.

## O que será feito
1. Os 2 cadastros de "ANA CLAUDIA NUNES MARTINS" passam para **ANA CLAUDIA**.
2. O cadastro de "Fabiana Grisi" passa para **ALICE FABIANA**, e o cartão dele no CRM recebe ALICE FABIANA como responsável.
3. Os nomes antigos "ANA CLAUDIA NUNES MARTINS" e "Fabiana Grisi" ficam desativados e não aparecem mais.
4. Resultado no Centro: ANA CLAUDIA 5 e ALICE FABIANA 2.

## Para não voltar a acontecer
- Ao editar o nome de um usuário, o nome dele no Atendimento também é atualizado, em vez de virar um nome novo.

## Detalhes técnicos
- UPDATE `submissions.attendant_id` com base no `owner_id` da oportunidade e no `full_name` atual do perfil. Atualizar `opportunities.owner_id` (null → ALICE). `presenters.active=false` para os dois nomes antigos.
- `updateUser`: ao trocar `full_name`, renomear os `presenters` (kind secretaria) com o nome antigo, nas escolas do usuário.
