# Versões do portal no GitHub

## Como vai funcionar
Depois que o GitHub estiver conectado (passo anterior), **cada alteração feita no portal vira automaticamente uma versão salva no GitHub**, com data, hora e descrição. Não é preciso fazer nada manualmente.

## Marcar versões importantes ("pontos de restauração")
Para achar fácil uma versão boa no futuro, crie marcos no GitHub:
1. No repositório, abra **Releases → Draft a new release**.
2. Em **Tag**, escreva um nome, por exemplo `v1.0-2026-11-12`.
3. Escreva o que está funcionando nessa versão e clique em **Publish release**.

Sugestão: criar um marco antes de cada mudança grande (ex.: integrações novas, relatórios).

## Como voltar a uma versão anterior
- **Pelo próprio Lovable (mais simples):** no histórico do chat, cada mensagem tem a opção **Restaurar** para voltar o portal àquele ponto. O GitHub recebe essa volta automaticamente.
- **Pelo GitHub:** abra o histórico (**Commits**) ou o marco desejado, veja o código daquela data e peça aqui no chat: "volte o portal para a versão `v1.0-2026-11-12`" — eu reaplico aquele código.

## Limites importantes
- Voltar versão restaura **o código** (telas, regras, integrações). **Não** volta os dados (cadastros, cartões, matrículas) — esses ficam no banco e não são apagados nem restaurados.
- Senhas e chaves não ficam no GitHub.

Nenhuma alteração no sistema é necessária; basta ter o GitHub conectado.
