# Matrículas compactas e motivos de perda

## Resultado esperado

- Reduzir o card **Matrículas efetivadas**, eliminando o espaço vazio e mantendo total, percentual e barra de progresso visíveis.
- Abaixo dele, criar o indicador **Motivos de perda** em gráfico de pizza.
- Cada motivo terá uma cor própria na pizza e na legenda, acompanhado da respectiva quantidade.
- Os dois indicadores ocuparão a coluna à direita de **Série de interesse**, um abaixo do outro.
- Em telas menores, os indicadores serão empilhados e continuarão legíveis.

## Regras dos dados

- O gráfico contará oportunidades marcadas como perdidas no ano atual, usando a data em que a perda foi registrada.
- A contagem será agrupada pelo motivo de perda selecionado no CRM.
- O gráfico respeitará exatamente o mesmo filtro de uma ou várias escolas da Visão Geral.
- Oportunidades sem motivo serão agrupadas como **Sem motivo informado**.
- Quando não houver perdas no período, será exibido **Nenhuma perda no período**.

## Detalhes técnicos

- Ampliar `getDashboardStats` para consultar oportunidades com status `lost`, `closed_at` dentro do ano atual e escola dentro da seleção ativa.
- Associar `crm_close_reasons`, agrupar por rótulo e retornar `lossReasons: { label, count }[]`, em ordem decrescente.
- Criar no painel um gráfico de pizza reutilizando a paleta semântica já usada em **Como conheceu a escola**.
- Ajustar a grade principal para manter **Série de interesse** à esquerda e uma coluna compacta à direita com **Matrículas efetivadas** e **Motivos de perda**.
- Manter a atualização automática existente e invalidar o painel após uma oportunidade ser marcada como perdida ou reaberta.
- Validar tipos, formatação e a disposição em desktop e celular.
