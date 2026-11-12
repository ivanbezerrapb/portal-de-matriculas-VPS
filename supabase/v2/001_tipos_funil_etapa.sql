-- Portal de Matrículas v2 — Fase 0
-- Tipos fixos de funil e de etapa, para que as automações (agendar, faltou,
-- check-in, matrícula) não dependam mais do NOME do funil ou da etapa.
--
-- Migração aditiva e idempotente: só cria colunas e preenche a partir dos nomes
-- atuais. Não apaga nem renomeia nada. Pode ser rodada mais de uma vez.

-- ---------- Funil ----------
alter table public.funnels
  add column if not exists kind text;

do $$ begin
  alter table public.funnels
    add constraint funnels_kind_check check (kind in ('leads', 'visitantes'));
exception when duplicate_object then null; end $$;

-- Mesma regra usada hoje no código: nome com "lead" = Lista de LEADS.
update public.funnels
   set kind = case when lower(name) like '%lead%' then 'leads' else 'visitantes' end
 where kind is null;

-- ---------- Etapa ----------
alter table public.funnel_stages
  add column if not exists kind text;

do $$ begin
  alter table public.funnel_stages
    add constraint funnel_stages_kind_check check (kind in (
      'visita_agendada',      -- LEADS: data de visita marcada
      'reagendar_visita',     -- LEADS: faltou à visita
      'visita_realizada',     -- LEADS: check-in feito (ganho)
      'matricula_agendada',   -- Pós-visita: data de matrícula marcada
      'reagendar_matricula',  -- Pós-visita: faltou à matrícula
      'matriculado'           -- Pós-visita: matrícula realizada (ganho)
    ));
exception when duplicate_object then null; end $$;

-- Cada tipo aparece no máximo uma vez por funil.
create unique index if not exists funnel_stages_funnel_kind_uniq
  on public.funnel_stages (funnel_id, kind)
  where kind is not null;

-- Preenche a partir dos nomes atuais (sem acento, minúsculo), mesma lógica do código.
-- Se dois nomes casarem com o mesmo tipo, fica com a primeira etapa (menor posição).
with base as (
  select s.id, s.funnel_id, s.position, f.kind as funnel_kind,
         translate(lower(s.name), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as n
    from public.funnel_stages s
    join public.funnels f on f.id = s.funnel_id
   where s.kind is null
),
guess as (
  select id, funnel_id, position,
    case
      when n like '%reagend%' and n like '%visita%'      then 'reagendar_visita'
      when n like '%reagend%' and n like '%matricula%'   then 'reagendar_matricula'
      when n like '%reagend%' and funnel_kind = 'leads'  then 'reagendar_visita'
      when n like '%reagend%'                            then 'reagendar_matricula'
      when n like '%visita agendada%'                    then 'visita_agendada'
      when n like '%matricula agendada%'                 then 'matricula_agendada'
      when n like '%matriculado%'                        then 'matriculado'
      when n like '%realizad%' and funnel_kind = 'leads' then 'visita_realizada'
    end as kind
  from base
),
pick as (
  select distinct on (g.funnel_id, g.kind) g.id, g.kind
    from guess g
   where g.kind is not null
     and not exists (
       select 1 from public.funnel_stages x
        where x.funnel_id = g.funnel_id and x.kind = g.kind
     )
   order by g.funnel_id, g.kind, g.position
)
update public.funnel_stages s
   set kind = p.kind
  from pick p
 where s.id = p.id;

-- Conferência (rodar à parte): funis e etapas sem tipo depois do preenchimento.
-- select f.name as funil, f.kind, s.name as etapa, s.kind
--   from public.funnels f join public.funnel_stages s on s.funnel_id = f.id
--  order by f.name, s.position;
