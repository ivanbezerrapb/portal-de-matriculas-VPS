# Imagem não sai na primeira impressão

## O que está acontecendo

A tela de impressão considera a ficha "pronta" assim que calcula as posições dos textos, sem esperar as imagens (logo/cabeçalho) terminarem de baixar. Na primeira vez a imagem ainda está vindo da internet, a janela de impressão abre antes e o espaço sai em branco. Na segunda vez a imagem já está guardada no navegador, aparece instantaneamente e tudo imprime certo.

## Correção

- A ficha só é considerada pronta quando **todas as imagens do modelo tiverem terminado de carregar**.
- O botão "Imprimir" fica indisponível e a impressão automática aguarda até lá.
- Se alguma imagem falhar ou demorar demais (limite de alguns segundos), a impressão segue mesmo assim, para nunca travar.
- Vale tanto para a impressão manual quanto para a impressão direta a partir da lista de cadastros.

## Detalhes técnicos

- `BlockView.tsx`: o bloco `image` passa a avisar quando a imagem carregou ou falhou (`onLoad` / `onError`) através de uma callback opcional.
- `DynamicPrintPage.tsx`: conta quantos blocos de imagem com URL existem na página e só reporta `ready: true` quando o total de imagens resolvidas alcançar essa contagem (além da medição atual). Imagens já em cache (`img.complete`) contam de imediato.
- `PrintSheets.tsx`: mantém a lógica atual de `pageStatus`; como o `ready` agora inclui as imagens, tanto `canPrint` quanto o `autoPrint` passam a esperar por elas. Acrescentar um tempo-limite de segurança (~5s) que libera a impressão mesmo com imagem pendente.
- Sem mudança de banco, permissões ou rotas.
