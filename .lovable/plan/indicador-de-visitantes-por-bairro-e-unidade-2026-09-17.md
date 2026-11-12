# Indicador de visitantes por bairro e unidade

Novo card na tela Início mostrando de onde vêm os visitantes, separado por unidade.

## Como vai funcionar

- Card "Visitantes por bairro", abaixo dos indicadores atuais, ocupando a largura das duas primeiras colunas.
- Para cada unidade selecionada no filtro, uma seção com o nome da unidade e o ranking dos bairros em barras (do maior para o menor).
- Cada barra mostra "Bairro — Cidade" e a quantidade de visitas.
- Mostra os 8 bairros com mais visitas por unidade; os demais somam em "Outros".
- Considera apenas o ano letivo atual (01/08 a 31/07), igual aos outros indicadores, e respeita o filtro de escolas.
- Quando a unidade não tiver endereços preenchidos, aparece "Nenhum endereço no período".
- Bairros escritos com variações de maiúsculas/acentos/espaços são agrupados como um só, exibindo a grafia mais frequente.

## Detalhes técnicos

- `src/lib/ext/cadastros.functions.ts`: `getDashboardStats` passa a retornar `neighborhoods: { school: string; items: { label: string; city: string; count: number }[] }[]`.
  - Fonte: `submission_values` com `part = 'bairro'` e `part = 'cidade'` dos cadastros já filtrados por ano letivo e escolas; junção por `submission_id` para associar bairro, cidade e `school_id`.
  - Normalização da chave de agrupamento (minúsculas, sem acentos, espaços comprimidos); rótulo exibido = grafia mais frequente.
- `src/routes/_authenticated/dashboard.tsx`: novo componente `NeighborhoodChart` reutilizando o padrão visual de `SeriesChart` (barras horizontais, tokens de cor existentes), com uma seção por unidade e agrupamento de "Outros".
  - Inserido na grade de indicadores com `@min-[36rem]/dashboard:col-span-2`, mantendo empilhamento no celular.
- Sem alteração de banco, permissões ou dos demais cálculos.
