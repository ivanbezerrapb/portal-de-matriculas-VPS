# Corrigir o nome dos contatos no Maxbot

## O que aconteceu
O nome do card no portal já vem como "0019/EX2027 · Rosa Maria". Ao mandar o nome para o Maxbot, o portal usou o nome inteiro do card e acrescentou o código no final. Por isso ficou "0019/EX2027 · ROSA MARIA (0019/EX2027)". Na conta Maxbot Conecta, 30 contatos já foram alterados assim. A conta Interactivo não teve nenhum.

## O que vai mudar
- **Padrão único:** o nome enviado ao Maxbot fica sempre **Nome (ID PORTAL)**, por exemplo **Rosa Maria (0019/EX2027)**. O portal tira o código e o "·" do começo do nome do card antes de montar o nome.
- **Corrigir os 30 contatos:** o portal atualiza agora mesmo esses contatos no Maxbot Conecta para o padrão certo, e confere o resultado.
- **Daqui pra frente:** contatos novos e os atualizados pela rotina de 10 em 10 minutos já seguem o padrão correto.

## Detalhes técnicos
- `nameWithCode` em `maxbot.server.ts`: remove também o prefixo `^\S+/\S+\s*·\s*` (e um código entre parênteses no fim) antes de anexar ` (código)`.
- Correção única: script que lê o mapa `named` da conta Conecta, busca o card ligado a cada contato (mapa `contacts`) e chama `set_contact` com o nome corrigido. Depois confere 2 ou 3 contatos com `get_contact`.
- Teste pequeno para `nameWithCode`: "0019/EX2027 · Rosa Maria" + "0019/EX2027" vira "Rosa Maria (0019/EX2027)".
