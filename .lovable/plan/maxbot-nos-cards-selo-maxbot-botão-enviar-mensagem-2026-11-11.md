# Maxbot nos cards: selo "Maxbot" + botão Enviar mensagem

## O que o usuário vai ver
1. **Selo verde "Maxbot"** ao lado do telefone do card (janela grande e painel lateral) quando o contato já existe no Maxbot.
   - Se não existir, aparece um selo cinza "Sem Maxbot" com o botão **Cadastrar no Maxbot** (caso a rotina automática tenha falhado).
2. **Cadastro automático**: quando um card novo é criado (formulário, lista de LEADS, visitante, importação etc.), o portal procura o telefone no Maxbot da marca da escola (Conecta: Centro/Expedicionários; Interactivo: Cristo/Bessa). Se não achar, cadastra o contato com Nome e Telefone. Leads vindos do próprio Maxbot já ficam marcados.
3. **Botão "Enviar mensagem"** logo abaixo de "Ver ficha completa", ativo só quando o selo está verde:
   - Abre janela com nome, WhatsApp, lista de templates da conta e prévia do texto.
   - Envia o template no nome do **usuário logado** (atendente vinculado em Usuários). Se o usuário não tiver vínculo, o botão avisa e não envia.
   - Envio como **follow-up** (abre o atendimento no Maxbot já na fila do atendente, pronto para a resposta do cliente).
4. **Histórico e Log**: cadastro no Maxbot e cada envio entram no histórico do card e no Log de Registro.

## Regras
- Conta sem token salvo (hoje: Interactivo): nada é cadastrado, selo mostra "Maxbot não configurado".
- Telefone comparado só pelos dígitos, com DDI 55.
- Falha na API do Maxbot nunca impede a criação do card; tenta de novo na próxima rodada automática (a cada 10 min) ou pelo botão.

## Detalhes técnicos
- `maxbot.server.ts`: `findContactByPhone`, `createContact` (`put_contact`), `listTemplates`, `sendTemplate` (`open_followup` com `attendant_id`/`sector_id`).
- Vínculo card→contato Maxbot salvo no arquivo privado `integracoes/maxbot.json` (mapa por submission id), pois o banco externo não tem migração.
- Gancho chamado após `applyDestination` e na rotina `/api/public/maxbot-import`, que também varre cards recentes sem vínculo (recuperação).
- Novas server functions em `maxbot.functions.ts`: `getCardMaxbotStatus`, `registerCardInMaxbot`, `listMaxbotTemplates`, `sendMaxbotTemplate` (com `requireAuth` e checagem de escola do usuário).
- UI no `pipeline` (janela grande e painel lateral): selo, botão e diálogo de envio.
