# Bairros e "Quem mais atendeu" com as 4 unidades lado a lado

## 1. Visitantes por bairro
- As 4 unidades (Bessa, Centro, Cristo, Expedicionários) ficam na mesma linha, uma ao lado da outra, ocupando toda a largura da tela.
- Rótulos de bairro mais compactos (quebram em linhas curtas, sem cortes) e barras com o valor.
- Em telas pequenas: 2 por linha; no celular, uma abaixo da outra.

## 2. Quem mais atendeu
- Passa a ser 4 cards, um por unidade (Centro, Cristo, Bessa, Expedicionários), na mesma linha.
- Nome do atendente completo (quebra em linhas, sem corte) e o valor no fim de cada barra; sem números no eixo de baixo.
- Respeita o filtro de escolas: unidades não selecionadas não aparecem. Unidade sem dados mostra "Sem dados".
- Mesmo comportamento responsivo do card de bairros.

## Técnico
- `cadastros.functions.ts` (`getDashboardStats`): nova saída `attendantsBySchool: { school, items: {label,count}[] }[]`, agrupando a contagem atual por `school_id`. Nenhuma mudança no banco.
- `dashboard.tsx`: card de bairros com grade `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`, largura do eixo de rótulos reduzida e `maxChars` menor; "Quem mais atendeu" vira 4 cards na mesma grade, reaproveitando o gráfico de barras horizontais com `LabelList` de valores e o `SeriesTick` com quebra de linha.
