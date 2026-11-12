# Substituir as marcas da barra lateral

## Resultado

- No menu lateral aberto, substituir a marca atual pela imagem branca horizontal **Grupo Inter Educacional** enviada.
- No menu lateral recolhido, exibir somente o símbolo quadrado enviado, centralizado e sem recorte.
- Manter a troca automática entre as duas imagens ao recolher ou expandir o menu.
- Preservar o fundo e todo o restante da navegação.
- Usar o símbolo enviado também como ícone da aba do navegador.

## Implementação

- Armazenar as duas imagens enviadas nos recursos do projeto e referenciá-las na barra lateral.
- Ajustar o espaço da marca aberta para valorizar o logotipo branco diretamente sobre o fundo da barra, removendo o fundo claro atual.
- Ajustar dimensões e enquadramento do símbolo no estado recolhido.
- Criar uma cópia quadrada otimizada do símbolo em `public/favicon.png` e manter a referência existente do ícone do navegador.
- Conferir visualmente os estados aberto e recolhido em tela grande e o menu móvel.
