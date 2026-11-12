# Sistema de Formulários por Escola (Supabase externo)

Mesma solução do plano aprovado, usando um **projeto Supabase externo** em vez do Lovable Cloud.

## Conexão com o Supabase externo — duas opções

**Opção A (recomendada):** você conecta em **Project Settings → Connectors → Supabase** (login no navegador). Esse passo só você consegue fazer — eu não tenho como concluí-lo pelo chat.

**Opção B (alternativa, caso a Opção A não funcione):** você me fornece as credenciais do seu projeto por um **formulário seguro** que eu abro aqui no chat. Preciso de 3 valores, encontrados no painel do seu Supabase em **Project Settings → Data API / API Keys**:
- **Project URL** (ex.: `https://abcdefgh.supabase.co`)
- **Chave publishable/anon** (`sb_publishable_...` ou `eyJ...`)
- **Chave service_role** (`sb_secret_...` ou `eyJ...`)

Com esses valores guardados com segurança, eu mesmo configuro o app inteiro para usar o seu Supabase (login, banco, permissões). As chaves nunca aparecem no código nem no chat.

Após conectar, também aplico todas as tabelas e políticas de segurança diretamente no seu banco.

## Escopo (inalterado)

1. **Acesso e contas** — login/cadastro com e-mail e senha; área interna protegida; visitantes só acessam links públicos de formulário.
2. **Perfis** — Administrador (tudo), Gestor de escola (só a própria escola), Operador de impressão (só consulta/imprime a própria escola), Editor de cadastros (completa/edita cadastros pelo ID, todas as escolas). Permissões aplicadas na tela e no servidor, com roles em tabela separada (`user_roles`).
3. **Escolas e ID** — 4 escolas iniciais; cada uma com prefixo + número sequencial configuráveis (ex.: `ESC01-0001`), gerados de forma única e segura contra concorrência.
4. **Construtor de formulários** — formulários por escola; campos de texto, texto longo, número, data, seleção única, múltipla escolha, sim/não, e-mail e telefone; obrigatório/ordem/ajuda; campos de preenchimento interno; publicar e copiar link público.
5. **Formulário público** — página aberta pelo link, validação e tela de confirmação exibindo o ID gerado.
6. **Listagem de cadastros** — tabela com ID, escola, formulário e data; busca por ID e filtros; detalhe/edição interna; histórico de alterações.
7. **Impressão configurável** — vários modelos por formulário (título, logo, cabeçalho/rodapé, campos e ordem, 1 ou 2 colunas, A4/A5, espaço para assinatura); pré-visualização, impressão/PDF pelo navegador, impressão em lote.

## Detalhes técnicos

- Tabelas: `schools`, `user_roles`, `profiles`, `forms`, `form_fields`, `submissions`, `submission_values`, `print_templates`, `audit_log` — todas com RLS, grants e função `has_role`.
- Escopo por escola aplicado nas políticas de RLS e nas funções de servidor.
- ID sequencial por escola gerado em função no banco com bloqueio de linha.
- Envio público via função de servidor com validação; leitura pública apenas de formulários publicados.
- Impressão via CSS `@media print`, sem dependência externa.
- Ordem de entrega: conexão → autenticação e permissões → escolas e IDs → construtor e formulário público → listagem/edição → impressão → gestão de usuários.
