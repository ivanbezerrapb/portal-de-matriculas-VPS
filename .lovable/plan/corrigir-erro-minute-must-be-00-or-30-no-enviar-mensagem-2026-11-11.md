# Corrigir erro "Minute must be 00 or 30" no Enviar mensagem

## O que aconteceu
O Maxbot exige o campo de data e hora no envio de template, mesmo quando o envio é imediato, e só aceita horários "redondos" (minuto 00 ou 30, segundos 00). O portal mandava a hora exata do clique (ex.: 19:12:47), e o Maxbot recusou. Nenhuma mensagem foi enviada.

## Correção
- Ao enviar, o portal passa a mandar a hora de Brasília arredondada para a meia hora em curso (ex.: clique às 19:12 → "19:00:00"; às 19:41 → "19:30:00"), mantendo o envio como imediato.
- Se o Maxbot ainda recusar por considerar o horário no passado, tentar automaticamente com a próxima meia hora (ex.: 19:30:00).
- Teste automático para a regra de arredondamento (19:12:47 → 19:00:00; 19:41:05 → 19:30:00; 19:30:00 → 19:30:00).

## Detalhes técnicos
- `src/lib/ext/maxbot.functions.ts` (linha ~341, `open_followup`): substituir o `date_time` pela função `maxbotSlot(date)` em `maxbot.server.ts` (UTC-3, minuto `<30 ? 00 : 30`, segundos 00).
- Fallback: se a resposta `msg` mencionar data/horário passado, repetir com slot + 30 min.
- Teste em `src/lib/ext/maxbot-name.test.ts` (ou novo `maxbot-slot.test.ts`).
