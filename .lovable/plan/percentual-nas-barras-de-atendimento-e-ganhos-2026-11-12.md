# Percentual nas barras de Atendimento e Ganhos

Nos gráficos "Quem mais atendeu (Coordenação)" e "(Central de Informações)" do Início, o número ao lado das barras verde (Atendimento iniciado) e amarela (Matriculados / Visitas realizadas) passa a mostrar também o percentual em relação aos Vinculados.

Exemplo (Laura Maria, 44 vinculados): verde "12 (27%)", amarela "12 (27%)". Barra roxa continua só com o número. Se Vinculados = 0, mostra só o número.

O selo vermelho sob o nome continua igual.

## Técnico
- `src/routes/_authenticated/dashboard.tsx`, LabelList de `started` e `won` (linhas ~318 e ~323): usar `content`/`formatter` com acesso ao `count` da linha para renderizar `valor (pct%)`, arredondado com `Math.round`.
