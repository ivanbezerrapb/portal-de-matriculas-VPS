# Série não aparece em alguns registros (ex.: 0051/BE2027)

## O que encontrei
- A série do 0051/BE2027 **foi salva corretamente**: as duas crianças estão com "3º EM".
- O problema está na hora de montar a lista: o portal busca de uma só vez as respostas (nome, crianças, série, restrições) de **todos** os registros, e o banco devolve no máximo 1.000 linhas por consulta. Como as listas já passam desse volume, parte dos registros fica sem a série (e às vezes sem o triângulo de pendência) mesmo estando gravada.

## O que vou fazer
- Buscar essas respostas em lotes (por grupos de registros e páginas de 1.000), até trazer tudo.
- Aplicar a mesma correção nos outros pontos que usam a mesma consulta (Início/relatórios por série), para os números baterem.
- Conferir depois que o 0051/BE2027 mostra "3º EM" na Lista de Visitantes e o filtro Série passa a encontrá-lo.

## Detalhes técnicos
- `src/lib/ext/cadastros.functions.ts` (~linha 113): trocar a consulta única em `submission_values` por helper que divide `submission_id` em blocos (~200) e pagina com `.range()`.
- Revisar outras consultas `.in("submission_id", ...)` no mesmo arquivo (dashboard, contagem de séries ~linha 1125) e usar o mesmo helper.
