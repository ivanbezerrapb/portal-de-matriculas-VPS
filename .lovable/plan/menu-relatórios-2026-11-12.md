# Menu Relatórios

## O que muda
Novo menu **Relatórios** na barra lateral (abaixo de Calendário), visível só para **Admin, Direção e Gerentes**. Gerente vê apenas as suas unidades; Admin e Direção veem todas. Dois submenus:

### 1. Relatório de Matriculados
- **Filtros:** Escola e período (data da matrícula, de/até).
- **Totais no topo:** matrículas por unidade (na ordem Centro, Expedicionários, Cristo, Bessa) e por série.
- **Tabela:** uma linha por ficha matriculada — ID, Responsável, Crianças, Série, Qtd. de matrículas, Data da matrícula, Quem efetivou.
- Fichas antigas sem data de matrícula aparecem só quando não há filtro de período.

### 2. Relatório de Atendimento
- **Filtros:** Escola, Atendente, Funil, Período (data de criação do cartão), "Só com pendências" e "Só com tarefas atrasadas".
- **Totais por atendente:** cartões, abertos, ganhos, perdidos, com pendência e com tarefa atrasada.
- **Tabela:** uma linha por cartão — Cliente (código e nome), Funil, Etapa, Atendente, Status (Aberto/Ganho/Perdido), Pendências (marcador de pendência pedagógica) e Tarefas atrasadas (quantidade).

### Impressão
- Cada relatório tem o botão **Imprimir**, que gera o PDF em A4 deitado conforme os filtros, no mesmo estilo da impressão das listas: logo, título com o **nome do relatório**, **nome da escola** em destaque (ou as escolas presentes, se não houver filtro), filtros usados, data/hora, quem imprimiu, totais e a tabela, sem faixa verde.

## Detalhes técnicos
- Rotas novas: `src/routes/_authenticated/relatorios.matriculados.tsx` e `relatorios.atendimento.tsx`, cada uma com `head()` próprio; grupo "Relatórios" em `route.tsx` exibido quando `isAdmin || isDirecao || managerSchools.length > 0`.
- Server functions novas em `src/lib/ext/relatorios.functions.ts` com `requireAuth` + `getPerms`; recusam quem não for Admin/Direção/Gerente e limitam as escolas às permitidas. Leituras via `extAdmin()` restritas a essas escolas; `submission_values` buscadas em lotes (mesmo helper usado nas listas para não cortar em 1.000 linhas).
- Matriculados: `submissions` com `enrolled = true`, série das respostas do formulário, `enrolled_by` → nome do perfil.
- Atendimento: `opportunities` + etapa + funil + responsável; tarefas atrasadas = tarefas não concluídas com vencimento passado; pendências usando a mesma regra do triângulo laranja.
- Impressão: generalizar `src/components/print/ListReport.tsx` (colunas e blocos de totais configuráveis) e reutilizar nos dois relatórios; as listas continuam iguais.
- Regras de totalização em funções puras com teste vitest (soma por unidade/série; contagem por atendente; filtro de atrasadas).
