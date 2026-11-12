# Redesign do sistema com a identidade Grupo Inter

## Objetivo
Atualizar o login e todas as telas internas para um visual semelhante ao painel de referência, usando a direção **Portal leve**, a logo oficial do Grupo Inter e a paleta institucional escolhida.

## Identidade visual
- Incorporar a logo enviada como ativo oficial do sistema.
- Criar uma versão quadrada da marca para o ícone do navegador, sem distorcer a imagem.
- Usar a paleta fixa da marca: azul institucional `#46449A`, azul-claro `#7ED3F7`, cinza `#7D7E82` e fundo claro `#F7F8FC`.
- Usar **Sora** nos títulos e **Manrope** nos textos e controles.
- Substituir o visual atual neutro por superfícies claras, sombras discretas, bordas suaves e estados de foco/seleção com as cores da marca.

## Tela de login
- Centralizar a logo completa acima do formulário, com destaque suficiente para ser a primeira identificação visual.
- Aplicar a composição leve escolhida: fundo institucional sutil, formulário claro e compacto, campos com ícones e botão azul de alto contraste.
- Preservar login, cadastro e mensagens existentes, sem adicionar funções ou links fictícios.
- Adaptar a composição para celular sem cortes ou sobreposição.

## Área interna
- Transformar a navegação atual em um menu lateral azul, compacto e recolhível, mantendo ícones visíveis quando fechado.
- Exibir a marca no topo do menu e os dados do usuário na base, seguindo a hierarquia do painel de referência.
- Adicionar um cabeçalho claro sobre o conteúdo, com título contextual da página e controle para recolher/abrir o menu.
- Manter as permissões atuais: cada pessoa continuará vendo somente as opções permitidas para seu perfil.
- Aplicar o novo padrão visual às telas de início, cadastros, formulários, templates, escolas, usuários e detalhes, sem alterar regras ou dados.

## Conteúdo e componentes
- Atualizar cartões, filtros, tabelas, formulários, abas, diálogos, avisos e botões para uma linguagem visual única.
- Priorizar a tabela nas páginas de gestão, com cabeçalhos claros, linhas legíveis e ações em ícones.
- Reorganizar o início com cartões compactos de indicadores e um resumo por escola, usando somente os dados que já existem.
- Preservar integralmente o editor visual e as páginas de impressão; apenas adequar controles externos à nova identidade, sem interferir no documento impresso.

## Responsividade e validação
- No celular, trocar o menu lateral por navegação acessível por botão, mantendo todo o conteúdo utilizável.
- Conferir login e telas internas em desktop e celular, incluindo tabelas largas, diálogos e estados vazios.
- Verificar contraste, foco por teclado, textos longos, carregamento e mensagens de erro.
- Confirmar que login, navegação, filtros, edição, cópia de links e impressão continuam funcionando após o redesign.

## Detalhes técnicos
- Centralizar cores, sombras e medidas em tokens semânticos no tema global.
- Reutilizar os componentes existentes e criar somente as peças estruturais necessárias para o menu recolhível e o cabeçalho.
- Atualizar os metadados das páginas que ainda não possuem título e descrição próprios, sem modificar o conteúdo funcional.
- Corrigir durante a validação o carregamento dinâmico instável detectado na prévia, caso ele ainda seja reproduzível após a atualização visual.
