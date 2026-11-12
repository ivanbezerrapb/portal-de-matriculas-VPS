# Concluir o sistema de formulários escolares

## Estado atual

- Integração com o Supabase externo: **funcionando** (credenciais salvas e conexão testada com sucesso).
- Banco de dados: o arquivo `supabase-setup.sql` está pronto no projeto, mas **ainda precisa ser executado por você** no SQL Editor do Supabase (painel do seu projeto → SQL Editor → colar o conteúdo → Run).
- Já construído no app: conexão, autenticação (login/senha), formulário público (`/f/...`), área logada com menu por perfil, painel inicial, gestão de escolas e lista de formulários.
- Decisão nova: **sem página inicial (landing)** — o endereço `/` abre direto a tela de login; quem já estiver logado cai no painel.

## O que falta construir

1. **Página de configuração do formulário** (`/formularios/:id`)
   - Aba Campos: adicionar/editar/excluir/reordenar campos (texto, número, data, escolhas, sim/não, e-mail, telefone), marcar obrigatório e "campo interno".
   - Aba Modelos de impressão: criar modelos escolhendo campos, título, cabeçalho/rodapé, 1 ou 2 colunas, A4/A5, logo e linha de assinatura.
   - Aba Publicar: título, descrição, status (rascunho/publicado/encerrado) e link público para copiar.

2. **Listagem de cadastros** (`/cadastros`)
   - Busca por ID (ex.: ESCA-0001), filtros por escola, formulário e período.
   - Seleção em lote para impressão.

3. **Detalhe/edição do cadastro** (`/cadastros/:id`)
   - Ver todos os dados, editar campos (conforme permissão), histórico de alterações, botão imprimir.

4. **Página de impressão** (`/imprimir/:templateId`)
   - Renderiza as fichas no modelo escolhido, uma por página, pronta para imprimir (Ctrl+P).

5. **Gestão de usuários** (`/usuarios`)
   - Criar usuários, atribuir perfis (administrador, gestor de escola, operador de impressão, editor) e vincular gestor/operador a uma escola.

6. **Entrada direta no login**
   - Substituir a página inicial: `/` redireciona para `/auth` (ou para o painel, se já estiver logado).

7. **Verificação final**
   - Corrigir erros de compilação restantes e testar o fluxo completo no navegador.

## Passo necessário de você (antes dos testes)

1. Abra o arquivo `supabase-setup.sql` do projeto e execute o conteúdo no SQL Editor do seu Supabase.
2. Crie a primeira conta no app — ela vira Administrador automaticamente.

## Detalhes técnicos

- Stack: TanStack Start + `@supabase/supabase-js` apontando para o Supabase externo (variáveis `EXT_SUPABASE_*`, nunca expostas no navegador além da chave pública).
- Banco: 9 tabelas com RLS por perfil/escola; ID sequencial gerado por função SQL com trava de linha (`next_school_public_id`).
- Permissões aplicadas no servidor e no banco: gestor e operador só veem a própria escola; editor edita todas as escolas; exclusões só do administrador.
