# Menu com grupos e submenus

Reorganizar a barra lateral em quatro blocos, mantendo as mesmas telas que já existem hoje.

## Nova estrutura

```text
INÍCIO            -> painel atual
CADASTROS         -> listagem de cadastros
CRM (Em breve)
  Pipeline        -> página "em breve"
  Funil           -> página "em breve"
CONFIGURAÇÕES
  Formulários
  Templates
  Escolas
  Usuários
```

## Comportamento

- INÍCIO e CADASTROS continuam links diretos, visíveis para todos.
- CRM e CONFIGURAÇÕES viram grupos que abrem e fecham ao clicar, com seta indicativa.
- O grupo que contém a página aberta já aparece expandido ao entrar.
- CRM mostra a etiqueta "Em breve"; Pipeline e Funil abrem uma página simples avisando que o recurso está em construção.
- CONFIGURAÇÕES e seus itens só aparecem para administradores, como já acontece hoje com Formulários, Templates, Escolas e Usuários.
- Com o menu recolhido, os grupos mostram só o ícone; ao clicar, o menu expande para revelar os subitens.
- No celular, o menu lateral continua abrindo e fechando como hoje.
- O título no topo passa a mostrar a página atual (ex.: "Configurações › Escolas").

## Detalhes técnicos

- Alterar apenas `src/routes/_authenticated/route.tsx`: estrutura de navegação em árvore (item ou grupo com filhos), estado local de grupos abertos inicializado pelo pathname, e renderização com o mesmo estilo visual atual.
- Criar `src/routes/_authenticated/crm.pipeline.tsx` e `src/routes/_authenticated/crm.funil.tsx` como páginas "em breve" (usando `EmptyState` de `@/components/ui`), cada uma com seu próprio `head()` (título e descrição próprios).
- Nenhuma mudança de banco, permissões ou rotas existentes.
