# Cartão do Pipeline: mostrar a próxima atividade

## O que muda no cartão

- Sai a data de entrada do cadastro que aparece hoje ao lado da etiqueta da etapa.
- No lugar dela aparece a **próxima atividade pendente** da oportunidade: título curto + data de vencimento.
- Cores da data da atividade:
  - no prazo (vence depois de hoje): sem cor, cinza discreto;
  - vence hoje: verde;
  - vencida: vermelha.
- Quando não houver atividade pendente, o cartão mostra "Sem atividade" em cinza.
- Havendo mais de uma pendente, mostra a de vencimento mais próximo.

## Tarefa automática na 1ª etapa

- Toda oportunidade que entrar na **primeira etapa** de qualquer funil ganha automaticamente a tarefa **"1º CONTATO"**.
- Vencimento: D+1 em **dias úteis** — criada na sexta vence na segunda; no sábado/domingo vence na segunda seguinte.
- Vale tanto para cadastros vindos dos formulários quanto para oportunidades criadas manualmente no quadro.
- Não duplica: se a oportunidade já tiver a tarefa "1º CONTATO", nada é criado.

## Detalhes técnicos

**Banco**
- Função `public.next_business_day(date)`: soma 1 dia e empurra sábado/domingo para a segunda.
- Função gatilho `public.crm_first_contact_task()` + trigger `after insert on public.opportunities`: quando `stage_id` é a etapa de menor `position` do `funnel_id` da linha, insere em `crm_tasks` (`title = '1º CONTATO'`, `due_date = next_business_day(current_date)`), com guarda de duplicidade por título.
- Funções `security definer` com `set search_path = public` para funcionar sob RLS.

**Server functions**
- `src/lib/ext/pipeline.functions.ts` › `listPipeline`: passa a trazer as tarefas pendentes das oportunidades do funil (consulta em `crm_tasks` por `opportunity_id in (...)`, `done = false`, ordenada por `due_date`), devolvendo um mapa `opportunity_id → { title, due_date }` da mais próxima.

**Tela**
- `src/routes/_authenticated/crm.pipeline.tsx`: remove `{formatDate(card.created_at)}` do cartão (linhas ~250-252) e renderiza no lugar o bloco da atividade, com classe de cor escolhida comparando `due_date` com a data de hoje (`text-muted-foreground` / `text-emerald-600` / `text-destructive`). O campo "Entrada" no painel de detalhes continua como está.

**Validação**: prettier, tsgo, eslint, `git diff --check`.
