# Sistema de Formulários por Escola

Plataforma com login, criação de formulários personalizados, links públicos de preenchimento, cadastros identificados por ID próprio de cada escola, modelos de impressão configuráveis e permissões por perfil.

## O que será construído

### 1. Acesso e contas
- Tela de login/cadastro com e-mail e senha.
- Área interna protegida; visitantes só acessam os links públicos de formulário.
- Página de usuários (somente Administrador) para convidar pessoas e definir perfil e escola.

### 2. Perfis e permissões
- **Administrador** — faz tudo: escolas, formulários, usuários, exclusões.
- **Gestor de escola** — vê e edita apenas os cadastros da escola dele.
- **Operador de impressão** — apenas consulta e imprime.
- **Editor de cadastros** — completa/edita dados dos cadastros pelo ID.

As permissões valem tanto na tela (botões que somem) quanto no servidor, para que ninguém contorne pela URL.

### 3. Escolas e o ID do cadastro
- O sistema nasce com 4 escolas já cadastradas (nomes confirmáveis depois, com o Administrador).
- **Restrição por escola:** Gestor de escola e Operador de impressão são vinculados a uma única escola e só veem, editam ou imprimem cadastros dessa escola. Administrador e Editor de cadastros acessam todas as escolas (o editor, apenas se preferir, também pode ser limitado por escola).
- Cadastro de escolas com nome e configuração do ID: prefixo (ex.: `ESC01`), número inicial e quantidade de dígitos.
- Cada envio recebe automaticamente um ID único no formato `ESC01-0001`, sem repetição mesmo com envios simultâneos.
- O ID é a chave de busca em todo o sistema.

### 4. Construtor de formulários
- Criar formulários vinculados a uma escola.
- Campos disponíveis: texto curto, texto longo, número, data, seleção única, múltipla escolha, sim/não, e-mail, telefone.
- Por campo: título, texto de ajuda, obrigatório ou não, ordem.
- Marcar campos como "preenchidos internamente" — não aparecem no formulário público, só na edição interna.
- Publicar/despublicar e copiar o link público.

### 5. Formulário público
- Página aberta por link, com identidade da escola, validação dos campos obrigatórios e tela de confirmação mostrando o ID gerado.

### 6. Listagem de cadastros
- Tabela com ID, escola, formulário, data e principais campos.
- Busca por ID e filtros por escola, formulário e período.
- Tela de detalhe para visualizar, completar campos internos e editar, respeitando o perfil.
- Histórico simples de quem editou e quando.

### 7. Modelos de impressão configuráveis
- Vários modelos por formulário (ficha completa, comprovante, etc.).
- Configuração: título, logo da escola, texto de cabeçalho e rodapé, escolha e ordem dos campos exibidos, layout em uma ou duas colunas, tamanho A4 ou A5, espaço para assinatura.
- Pré-visualização e impressão/geração de PDF pelo navegador.
- Impressão individual a partir do cadastro e impressão em lote a partir da listagem filtrada.

## Detalhes técnicos

- Backend no Lovable Cloud: banco de dados, autenticação por e-mail/senha e lógica no servidor.
- Tabelas: `schools`, `user_roles` (tabela separada, nunca no perfil), `profiles`, `forms`, `form_fields`, `submissions`, `submission_values`, `print_templates`, `audit_log`.
- Segurança em nível de linha (RLS) em todas as tabelas, com função `has_role` e checagem de escola do usuário; leitura pública apenas do formulário publicado, nunca dos cadastros.
- Geração do ID sequencial por escola em função no banco com bloqueio por linha, garantindo unicidade.
- Envio público através de função de servidor que valida os campos e grava o cadastro.
- Impressão via CSS de impressão dedicado (`@media print`), sem dependência externa.

## Ordem de entrega

1. Cloud + login + tabelas base e permissões.
2. Escolas com configuração de ID.
3. Construtor de formulários + link público + envio.
4. Listagem, busca por ID e edição interna.
5. Modelos de impressão e impressão em lote.
6. Gestão de usuários e perfis.
