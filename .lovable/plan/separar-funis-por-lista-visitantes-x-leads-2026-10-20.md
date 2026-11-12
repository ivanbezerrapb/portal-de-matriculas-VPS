# Separar funis por lista (Visitantes x LEADS)

## O que muda
- **Lista de Visitantes**: a coluna Funil mostra apenas os funis **Pós Visita** da unidade do cadastro. Os funis de LEADS deixam de aparecer.
- **Lista de LEADS**: a coluna Funil mostra apenas os funis de **LEADS** da unidade.
- Vale para todas as unidades (Centro, Cristo, Bessa, Expedicionários).
- O servidor também recusa o envio de um cadastro para um funil da lista errada, como proteção extra.
- Cartões que já existem não são alterados.

## Como o funil é reconhecido
Pelo nome, sem diferenciar maiúsculas nem acentos: nome com "lead" = funil de LEADS; os demais (ex.: "Pós Visita") = funil de Visitantes.
Se no futuro algum funil fugir desse padrão, basta incluir "Lead" no nome dele.

## Detalhes técnicos
- Helper `funnelListType(name)` em `src/lib/ext/model.ts` (normaliza e testa `/lead/`).
- `SubmissionsList.tsx` (linha ~493): filtro de opções passa a exigir `funnelListType(f.name) === listType` além de `school_id`.
- `cadastros.functions.ts` (`sendSubmissionToFunnel`): após carregar funil e cadastro, erro "Este funil não pertence a esta lista." se o tipo não bater com `submissions.list_type`.
- Sem mudança no banco.
