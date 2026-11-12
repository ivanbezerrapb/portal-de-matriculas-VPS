# Corrigir erro "Template must be FollowUp type!"

## O que aconteceu
O erro de horário foi resolvido; agora o Maxbot recusa o **template**. Na conta Maxbot Conecta, os 33 templates WABA são de três tipos:
- **Follow-up**: 14. Disparados pelo comando de follow-up, com atendente.
- **Aviso**: 2. Disparados por outro comando, o de aviso.
- **Chat**: 17. Só servem para responder dentro de uma conversa já aberta no Maxbot. Não dá para disparar pela integração.

O template padrão escolhido, "OLA LEMBRA DE NOSSA VISITA AMANHA", é do tipo **Chat**. Por isso não envia.

## Correção
1. Em Configurações › MAXBOT, o campo **Template padrão** lista só os templates WABA de **Follow-up** e **Aviso**, com o tipo ao lado do nome (ex.: "LEMBRETE VISITA (Follow-up)").
2. Ao enviar, o portal usa o comando certo para o tipo: Follow-up com o atendente escolhido, ou Aviso.
3. Se o template padrão salvo for do tipo Chat, a janela avisa: "O template padrão não pode ser disparado. Escolha um template de Follow-up ou Aviso em Configurações › MAXBOT." O envio fica bloqueado.
4. Depois disso, você precisa escolher de novo o template padrão da conta Conecta. Se o texto "lembra da visita" só existe como Chat, peça para criarem uma versão Follow-up no Maxbot.

## Detalhes técnicos
- `listFollowupTemplates` (`maxbot.server.ts`): filtrar WABA com `type` em F ou A, e devolver `type`.
- `Stored.default_template` passa a guardar `type`. Ao salvar, o servidor confere o tipo.
- `sendCardMaxbotTemplate`: busca o tipo atual do template. F → `open_followup` (atendente/setor, `date_time` em slot de 00/30); A → `send_notice` com as mesmas tags e `scheduled: 0`; C → erro amigável.
