# Aviso de conversa aberta no Maxbot e transferência para o atendente

## O que muda para o usuário
Quando o atendente clicar em **Enviar mensagem** e o Maxbot recusar porque o contato já tem uma conversa aberta:

1. Em vez do erro vermelho, abre uma janela **"Contato já em atendimento"**:
   "Não foi possível enviar esta mensagem agora porque o contato já está em conversa aberta no Maxbot com o(a) atendente **[nome]**."
2. Se o portal conseguir identificar a conversa aberta, a janela pergunta: **"Deseja transferir esta conversa para o seu usuário no Maxbot?"** com os botões **Transferir para mim** e **Cancelar**.
3. Ao transferir, aparece: "Conversa transferida. O contato já aparece no seu painel do Maxbot." e o histórico do card registra a transferência (também no Log de Registro).
4. Se o portal não conseguir identificar a conversa ou o atendente, a janela explica o bloqueio sem o botão de transferir (e mostra "atendente não identificado" no lugar do nome).
5. Administrador usando **Enviar como**: a transferência vai para o atendente escolhido.

## Limitação conhecida
Ainda não vimos o texto exato do erro do Maxbot nem consegui localizar uma conversa aberta pela API (a consulta de protocolos parece trazer só os encerrados). A detecção será feita por palavras-chave no erro e, para achar a conversa, o portal tentará a consulta de protocolos em andamento. Na primeira ocorrência real, o texto do erro ficará gravado para eu ajustar a detecção, se necessário.

## Detalhes técnicos
- `sendCardMaxbotTemplate` (`maxbot.functions.ts`): ao receber erro do `open_followup`/`send_notice` com termos como "protocol", "open", "attendance", "em atendimento", retornar `{ ok:false, busy:true, attendant_name, prot_id, raw }` em vez de lançar erro. Extrair nome/protocolo do texto do erro quando presente; senão consultar `get_prot` com `contact_id` e situações 1/2 (aguardando/em atendimento).
- Nova server function `transferCardMaxbotProtocol({ opportunity_id, prot_id, as_user_id? })`: valida permissão (as_user_id só admin), obtém atendente vinculado e setor (`attendantSector`), chama `forward_prot` com `prot_id`, `sector_id`, `attendant_id`; grava nota em `crm_notes` e `activity_logs`.
- Registrar o texto bruto do erro em `activity_logs` para calibração.
- `MaxbotSend` (`crm.pipeline.tsx`): novo estado "busy" exibindo a janela descrita acima e o botão de transferência.
