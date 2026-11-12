# Calendário, Data da visita nos cartões de LEADS e nome do cliente no cartão

## 1. Nome do cliente no cartão (correção)
Hoje o título do cartão só mostra o nome quando o campo "Nome" foi escolhido na aba Destino do formulário. Nos formulários de LEADS essa escolha não foi feita, então aparece só o ID.
- Correção: se a aba Destino não indicar o campo, o sistema usa automaticamente o campo do formulário chamado "Nome" (ou que começa com "Nome", como "Nome do responsável").
- Resultado: o título fica "1001/CE2027 · Flaviane" no cartão e na janela lateral, em todos os funis.

## 2. Campo "Data da visita" no cartão (só funis de LEADS)
- Na janela lateral do cartão, logo abaixo de "Dados do cliente", aparece a seção **Data da visita** com data e hora e o botão **Agendar visita**.
- Depois de agendada: mostra a data/hora, com opções **Alterar** e **Remover agendamento**.
- O cartão no quadro passa a mostrar um selo "Visita: 22/10 · 14:00".
- Aparece apenas em cartões vindos da Lista de LEADS. Direção só visualiza.

## 3. Novo menu CALENDÁRIO
- Item **Calendário** no menu lateral, abaixo de CRM, para todos os perfis (cada um vê só as unidades/funis que já pode ver).
- Visual semelhante ao Google Calendar: modos **Mês**, **Semana** e **Dia**, botões Hoje / anterior / próximo.
- Eventos:
  - **VISITA** (cor laranja): vem da Data da visita do cartão — "1001/CE2027 · Flaviane", na data e hora agendadas.
  - **MATRÍCULA** (cor verde): matrículas efetivadas (Lista de Visitantes) e check-ins confirmados (Lista de LEADS), no dia em que aconteceram, com ID e nome.
- Filtros: **Unidade** (Centro, Cristo, Bessa, Expedicionários — várias ao mesmo tempo) e **Tipo** (Visita, Matrícula).
- Clicar em uma visita abre um resumo com ID, nome, telefone (com WhatsApp), unidade e link "Abrir no Pipeline".
- Atualização automática a cada 30 segundos.

## Detalhes técnicos
- Banco externo: `opportunities.visit_at timestamptz null` (atualizar `supabase-setup.sql`); as policies atuais de `opportunities` já cobrem leitura/edição.
- `pipeline.functions.ts`: fallback de `name_field_id` para campo com rótulo normalizado começando por "nome" (tipo texto); `listPipeline` retorna `visit_at` e `list_type` da submissão; nova `setOpportunityVisit({ id, visit_at|null })` validando que a submissão é `list_type='leads'` e que o perfil não é Direção.
- Novo `src/lib/ext/calendario.functions.ts` `listCalendarEvents({ from, to, school_ids?, types? })` (requireAuth): visitas de `opportunities` (RLS do usuário) e matrículas de `submissions` (`enrolled_at`) + check-ins (`audit_log` action `check_in`), respeitando `getPerms` (unidades/funis); nome via mesma regra de fallback.
- Nova rota `src/routes/_authenticated/calendario.tsx` com `head()` próprio; grade de mês/semana/dia feita com `date-fns` (sem biblioteca nova); item no menu em `route.tsx`.
- `crm.pipeline.tsx`: seção Data da visita com seletor de data (shadcn) + hora, selo no cartão, invalidação de `["pipeline"]` e `["calendar"]`.
