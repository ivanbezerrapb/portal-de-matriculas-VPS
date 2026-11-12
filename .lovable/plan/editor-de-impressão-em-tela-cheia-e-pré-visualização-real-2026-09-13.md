# Editor de impressão em tela cheia e pré-visualização real

## Resultado

- A área de montagem poderá ocupar toda a tela, aproveitando a largura e a altura disponíveis.
- A folha A4 ou A5 será redimensionada automaticamente para aparecer inteira dentro da área de trabalho, sem corte horizontal, mantendo as proporções reais.
- O zoom manual continuará disponível para aproximação e ajustes finos, com uma opção para retornar ao ajuste automático.
- Um botão **Pré-visualizar impressão** permitirá conferir o modelo atual antes de salvá-lo.

## Pré-visualização com cadastro real

1. Ao clicar em **Pré-visualizar impressão**, será apresentada a lista de cadastros pertencentes ao mesmo formulário.
2. Após escolher um cadastro, a pré-visualização exibirá todas as páginas do modelo com seus dados reais.
3. A visualização usará imediatamente as alterações que estão no editor, mesmo que o modelo ainda não tenha sido salvo.
4. O acesso continuará respeitando as permissões já existentes por escola e usuário.

## Ajustes da área de edição

- Ampliar o espaço do editor na aba **Modelos de impressão**, removendo a limitação de largura enquanto um modelo estiver aberto.
- Adicionar controle para entrar e sair da edição em tela cheia.
- Calcular automaticamente a escala da folha conforme o espaço disponível e recalcular quando a janela mudar de tamanho.
- Manter a barra de blocos, páginas e propriedades acessível sem encobrir a folha.
- Em telas menores, organizar as propriedades abaixo da folha para evitar sobreposição.

## Detalhes técnicos

- Reaproveitar a mesma renderização de blocos usada na impressão final, garantindo correspondência entre editor, pré-visualização e papel.
- Consultar os cadastros do formulário pelas funções autenticadas existentes e montar o contexto de impressão com os valores do cadastro escolhido.
- Criar a pré-visualização como uma janela ampla sobre o editor, com páginas no tamanho proporcional correto e rolagem entre páginas.
- Não será necessária alteração no banco de dados.
- Validar o ajuste automático, tela cheia, seleção de cadastro e modelos com várias páginas em computador e tela estreita.
