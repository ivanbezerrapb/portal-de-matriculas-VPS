# Remover o submenu Apresentação

## O que muda

- Remover apenas o item **Apresentação** do menu; o grupo **Cadastros** continua com o filho **Lista de cadastros** (`/cadastros`).
- A tela `/apresentacao` é removida; quem abrir o endereço salvo cai direto na Lista de cadastros.
- Nada se perde: as colunas **Atendimento** e **Apresentação** continuam na Lista de cadastros, com autocompletar e a opção "Cadastrar «nome»", e os nomes cadastrados continuam salvos e alimentando os indicadores da tela Início (Quem mais atendeu / Quem mais apresentou).

## Detalhes técnicos

- `src/routes/_authenticated/route.tsx`: remover o filho "Apresentação" do grupo Cadastros e a entrada de `/apresentacao` nos caminhos permitidos (grupo e "Lista de cadastros" permanecem).
- `src/routes/_authenticated/apresentacao.tsx`: substituir o conteúdo por redirecionamento permanente para `/cadastros` (evita 404 em links salvos).
- Banco: sem mudança (`presenters`, `attendant_id`, `presenter_id` permanecem).
- Indicadores da Início e a exigência de preenchimento ao ativar matrícula: sem mudança.
