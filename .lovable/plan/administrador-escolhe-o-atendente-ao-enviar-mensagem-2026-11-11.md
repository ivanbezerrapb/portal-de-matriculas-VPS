# Administrador escolhe o atendente ao enviar mensagem

## Como fica
- **Administrador:** ao clicar em **Enviar mensagem**, a janela mostra primeiro o campo **Enviar como**. Ele lista os usuários do portal que estão vinculados a um atendente da conta Maxbot da unidade (por exemplo, "Maria Souza — atendente Maria"). Já vem marcado o próprio administrador, se ele tiver vínculo. Depois aparece a confirmação de sempre: "Tem certeza que deseja enviar o template padrão X?" e o botão **Sim, enviar**.
- **Demais perfis:** nada muda. A mensagem sai sempre em nome do próprio usuário, sem poder escolher.
- **Histórico e Log de Registro:** registram quem clicou (o administrador) e em nome de qual atendente a mensagem saiu.

## Detalhes técnicos
- `listCardMaxbotTemplates` passa a devolver `is_admin` e, quando for admin, a lista `attendants` (portalUserId, nome do usuário, nome do atendente) tirada do mapa `attendants` da conta.
- `sendCardMaxbotTemplate` aceita `as_user_id` opcional. O servidor só aceita esse campo se quem chama for administrador (`getPerms`); para os outros perfis ele é ignorado e vale o próprio usuário.
- `MaxbotSend` em `crm.pipeline.tsx`: seletor "Enviar como" visível só para administrador; o botão **Sim, enviar** fica bloqueado até haver atendente escolhido.
