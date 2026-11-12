# Listagem de cadastros: responsável e data com hora

## O que muda

1. A coluna **Formulário** passa a ser **Responsável**, mostrando o nome do responsável informado no cadastro.
2. A coluna **Data** passa a mostrar **data e hora** (ex.: 13/09/2026 14:32).

O filtro por formulário no topo da tela continua existindo normalmente.

## Detalhes

- Todos os formulários atuais têm o campo "Nome do Responsável" como primeiro campo, então a listagem busca a resposta desse campo para cada cadastro.
- Quando um cadastro não tiver esse campo preenchido, a coluna mostra um traço.

## Técnico

- `src/lib/ext/cadastros.functions.ts` (`listSubmissions`): após buscar as submissões, buscar em `form_fields` os campos cujo label normalizado seja "nome do responsavel" (fallback: primeiro campo `short_text` por `position`) dos formulários envolvidos, e em `submission_values` os valores desses campos para os ids retornados; anexar `responsible_name` a cada linha.
- `src/routes/_authenticated/cadastros.tsx`: trocar o cabeçalho "Formulário" por "Responsável" e a célula por `responsible_name` (com "—" quando vazio); trocar `toLocaleDateString("pt-BR")` por data + hora (`toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })`).
