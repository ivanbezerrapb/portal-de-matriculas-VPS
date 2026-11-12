# Configurar tudo no novo Supabase — sem você executar nada

Você já salvou o endereço do novo banco. A partir daqui eu faço tudo sozinho.

## O que eu faço agora

1. Aplico no novo Supabase toda a estrutura do banco (o conteúdo do `supabase-setup.sql`): tabelas, permissões, regras de acesso por perfil e escola.
2. Cadastro as 4 escolas iniciais (Escola A, B, C e D) com seus prefixos de ID.
3. Ligo a criação automática de perfil — a primeira conta criada no sistema vira Administrador.
4. Confirmo tabela por tabela que ficou tudo criado.
5. Testo o fluxo completo no navegador: criar conta, entrar, criar formulário, publicar link público, enviar um cadastro pelo link, ver na listagem, editar e imprimir.
6. Corrijo o que aparecer de erro nesses testes.

Se preferir, também crio sua conta de Administrador com um e-mail e senha que você me indicar — aí você só entra e usa.

## Detalhes técnicos

- Novos segredos salvos: `EXT_SUPABASE_URL`, `EXT_SUPABASE_PUBLISHABLE_KEY`, `EXT_SUPABASE_SERVICE_ROLE_KEY`, `EXT_SUPABASE_DB_URL` (projeto nrfqkavipnycifrucbfg).
- O SQL será aplicado via `psql` usando a conexão salva; se o banco já tiver algo, ajusto o script antes de reaplicar.
- O código do app já lê essas variáveis — nenhuma alteração de código é necessária para a troca de Supabase.
