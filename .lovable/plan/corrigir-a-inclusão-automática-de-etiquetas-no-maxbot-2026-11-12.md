# Corrigir a inclusão automática de etiquetas no Maxbot

## O que encontrei
- **Maxbot Conecta (Centro e Expedicionários): nenhum contato recebeu etiqueta (0 de 34).** As etiquetas salvas em Configurações › MAXBOT ("2026/2027 - CENTRO - CRM NOVO LEAD" e "... EXPEDICIONARIOS - CRM NOVO LEAD") não existem mais com esse nome no Maxbot. Lá elas se chamam "... - **IMPORTAR** CRM NOVO LEAD". O portal não encontra a etiqueta e não faz nada.
- **Maxbot Interactivo (Cristo e Bessa): 40 de 84 contatos receberam etiqueta.** Os outros 44 são de cards antigos. A rotina de 10 em 10 minutos só passa pelos cards dos últimos 3 dias, então esses contatos só recebem a etiqueta quando alguém abre o card.

## O que vou fazer
1. **Atualizar as etiquetas da Conecta** em Configurações › MAXBOT para os nomes atuais do Maxbot (Centro e Expedicionários, com "IMPORTAR"). Isso também destrava a importação automática de leads da Conecta.
2. **Avisar quando o nome não bater:** se uma etiqueta salva deixar de existir no Maxbot, Configurações › MAXBOT mostra um aviso nessa unidade e o caso entra no Log de Registro, em vez de falhar sem avisar.
3. **Rotina cobre todos os contatos vinculados:** além dos cards recentes, a rotina de 10 em 10 minutos passa a etiquetar todos os contatos já vinculados que ainda não têm a etiqueta, em lotes, até zerar a fila.
4. **Correção agora:** rodo uma vez a etiquetagem de todos os contatos pendentes nas duas contas e informo quantos receberam a etiqueta.

## Detalhes técnicos
- Corrigir os títulos em `segmentations` no `maxbot.json` (Conecta) para os títulos exatos de `get_segmentation`.
- `ensureContactSegmentation`: quando não achar o título, registrar no log (no máximo uma vez por execução por unidade); `getMaxbotSettings` passa a informar as etiquetas não encontradas para a tela mostrar o aviso.
- `syncRecentOpportunities`: além dos últimos 3 dias, percorrer o mapa `contacts` (opportunityId→contactId) dos contatos que ainda não estão em `tagged` para a unidade do card, com limite de cerca de 100 por execução.
- Execução única por script, chamando `add_contact_segmentation` e atualizando `tagged`.
