# Submenu MAXBOT em Configurações

## O que o usuário verá
- Novo item **MAXBOT** no menu Configurações (abaixo de Log de Registro), visível só para Administrador.
- Tela com:
  - **Token da API** (campo oculto com olho; depois de salvo mostra apenas "Token configurado", nunca o valor).
  - **Endereço da API** (preenchido com `https://app.maxbot.com.br/api/v1.php`).
  - **Integração ativa** (liga/desliga).
  - Botão **Testar conexão**: chama o Maxbot e mostra "Conectado" ou o erro em português.
  - Data/hora e autor da última alteração.
- Registro no Log de Registro quando alguém salvar ou testar.

## Fora deste passo
Mapear atendentes, setores e templates, e o envio de mensagens — ficam para as próximas etapas.

## Detalhes técnicos
- Tabela `maxbot_settings` (linha única): `api_url`, `enabled`, `token_set` flag, `updated_by`, `updated_at`; RLS só admin; grants corretos.
- Token guardado só no servidor (coluna acessível apenas via service role, ou tabela separada sem acesso pelo navegador); nunca retornado ao navegador.
- Server functions com `requireSupabaseAuth` + verificação de admin: `getMaxbotSettings`, `saveMaxbotSettings`, `testMaxbotConnection` (POST com o token e um comando simples de leitura da API).
- Rota `src/routes/_authenticated/maxbot.tsx` com head() próprio; item adicionado em `route.tsx`.
