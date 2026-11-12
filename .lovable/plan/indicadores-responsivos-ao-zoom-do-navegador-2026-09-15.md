# Indicadores responsivos ao zoom do navegador

## Resultado

- A tela **Início** passará a aproveitar toda a largura disponível, inclusive quando o navegador estiver com zoom reduzido.
- Os indicadores aumentarão ou diminuirão de forma fluida junto com a área útil, sem deixar grandes faixas vazias nas laterais.
- Ao aumentar o zoom e reduzir o espaço disponível, os cards serão reorganizados automaticamente em menos colunas para preservar textos, legendas e gráficos.
- Em telas largas, os três cards anuais e os três indicadores “Quem mais...” continuarão distribuídos igualmente; o gráfico de evolução continuará ocupando 2 de 3 colunas.
- No celular, os indicadores permanecerão empilhados e legíveis.

## Ajustes previstos

- Remover o limite fixo de largura do conteúdo da tela Início e usar toda a área disponível ao lado do menu.
- Tornar as grades dos indicadores responsivas em etapas, evitando a mudança brusca de três colunas diretamente para uma.
- Garantir que cada card tenha largura mínima segura e que os gráficos internos acompanhem a largura do card.
- Preservar as alturas iguais dentro de cada linha e todas as regras atuais de filtros e dados.

## Validação

- Conferir a tela em diferentes níveis de zoom do navegador e em larguras de computador e celular.
- Verificar que não haja rolagem lateral, cortes de nomes, sobreposição de legendas ou deformação dos gráficos.
- Nenhuma alteração no banco de dados ou nos cálculos dos indicadores.
