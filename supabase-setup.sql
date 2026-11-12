-- ============================================================
-- Sistema de Formulários por Escola — Setup do banco
-- Cole este script inteiro no SQL Editor do seu Supabase e clique em "Run".
-- ============================================================

-- 1) Perfis de usuário
create type public.app_role as enum ('admin', 'school_manager', 'print_operator', 'submission_editor');

-- 2) Escolas (com configuração do ID sequencial)
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  id_prefix text not null unique,
  id_next_number integer not null default 1,
  lead_next_number integer not null default 1001,
  id_digits integer not null default 4,
  created_at timestamptz not null default now()
);

-- 3) Perfis (dados básicos)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

-- 4) Papéis (sempre em tabela separada!)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  school_id uuid references public.schools(id) on delete cascade,
  unique (user_id, role, school_id)
);

-- 5) Formulários
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  public_slug text not null default gen_random_uuid()::text unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 6) Campos dos formulários
create table public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references public.forms(id) on delete cascade not null,
  label text not null,
  help_text text,
  type text not null check (type in ('short_text','long_text','number','date','single_choice','multiple_choice','yes_no','email','phone','children')),
  options jsonb,
  required boolean not null default false,
  internal boolean not null default false,
  position integer not null default 0
);

-- 7) Cadastros (envios)
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references public.forms(id) on delete cascade not null,
  school_id uuid references public.schools(id) on delete cascade not null,
  public_id text not null unique,
  children_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- 8) Valores dos cadastros
create table public.submission_values (
  submission_id uuid references public.submissions(id) on delete cascade not null,
  field_id uuid references public.form_fields(id) on delete cascade not null,
  value text,
  value_number numeric,
  primary key (submission_id, field_id)
);

-- 9) Modelos de impressão
create table public.print_templates (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references public.forms(id) on delete cascade not null,
  name text not null,
  title text not null,
  header_text text,
  footer_text text,
  show_logo boolean not null default false,
  columns integer not null default 1 check (columns in (1,2)),
  page_size text not null default 'A4' check (page_size in ('A4','A5')),
  show_signature boolean not null default false,
  field_ids jsonb not null default '[]',
  layout jsonb,
  created_at timestamptz not null default now()
);

-- 10) Histórico de alterações
create table public.audit_log (
  id bigint generated always as identity primary key,
  submission_id uuid references public.submissions(id) on delete cascade not null,
  actor_id uuid,
  actor_email text,
  action text not null,
  changes jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Grants
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select on public.schools to authenticated;
grant insert, update, delete on public.schools to authenticated;
grant all on public.schools to service_role;

grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.user_roles to authenticated;
grant insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select on public.forms to anon;
grant select, insert, update, delete on public.forms to authenticated;
grant all on public.forms to service_role;

grant select on public.form_fields to anon;
grant select, insert, update, delete on public.form_fields to authenticated;
grant all on public.form_fields to service_role;

grant select, insert, update, delete on public.submissions to authenticated;
grant all on public.submissions to service_role;

grant select, insert, update, delete on public.submission_values to authenticated;
grant all on public.submission_values to service_role;

grant select, insert, update, delete on public.print_templates to authenticated;
grant all on public.print_templates to service_role;

grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

-- ============================================================
-- Funções auxiliares
-- ============================================================

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Escolas às quais o usuário está vinculado como gestor ou operador
create or replace function public.user_school_ids(_user_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select school_id from public.user_roles
  where user_id = _user_id and role in ('school_manager','print_operator') and school_id is not null
$$;

-- Gera o próximo ID público da escola com bloqueio de linha (seguro contra concorrência)
create or replace function public.next_school_public_id(p_school_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_prefix text;
  v_number integer;
  v_digits integer;
begin
  update public.schools
     set id_next_number = id_next_number + 1
   where id = p_school_id
  returning id_prefix, id_next_number - 1, id_digits into v_prefix, v_number, v_digits;
  if v_prefix is null then
    raise exception 'Escola não encontrada';
  end if;
  return lpad(v_number::text, v_digits, '0') || '/' || v_prefix;
end;
$$;

-- Gera o próximo ID da Lista de LEADS, usando contador próprio e o prefixo da escola
create or replace function public.next_school_lead_id(p_school_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_prefix text;
  v_number integer;
begin
  update public.schools
     set lead_next_number = lead_next_number + 1
   where id = p_school_id
  returning id_prefix, lead_next_number - 1 into v_prefix, v_number;
  if v_prefix is null then
    raise exception 'Escola não encontrada';
  end if;
  return v_number::text || '/' || v_prefix;
end;
$$;

-- Cria perfil automaticamente; o PRIMEIRO usuário do sistema vira Administrador
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.forms enable row level security;
alter table public.form_fields enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_values enable row level security;
alter table public.print_templates enable row level security;
alter table public.audit_log enable row level security;

-- Escolas
create policy schools_select on public.schools for select to authenticated using (true);
create policy schools_write on public.schools for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy schools_update on public.schools for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy schools_delete on public.schools for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Perfis
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Papéis
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy user_roles_write on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy user_roles_update on public.user_roles for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy user_roles_delete on public.user_roles for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Formulários: público só vê publicados; internos veem conforme papel/escola
create policy forms_public_select on public.forms for select to anon using (status = 'published');
create policy forms_select on public.forms for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'submission_editor')
  or school_id in (select public.user_school_ids(auth.uid()))
);
create policy forms_write on public.forms for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy forms_update on public.forms for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy forms_delete on public.forms for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Campos
create policy form_fields_public_select on public.form_fields for select to anon using (
  exists (select 1 from public.forms f where f.id = form_id and f.status = 'published')
);
create policy form_fields_select on public.form_fields for select to authenticated using (
  exists (select 1 from public.forms f where f.id = form_id and (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'submission_editor')
    or f.school_id in (select public.user_school_ids(auth.uid()))
  ))
);
create policy form_fields_write on public.form_fields for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy form_fields_update on public.form_fields for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy form_fields_delete on public.form_fields for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Cadastros
create policy submissions_select on public.submissions for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'submission_editor')
  or school_id in (select public.user_school_ids(auth.uid()))
);
create policy submissions_update on public.submissions for update to authenticated using (
  public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'submission_editor')
  or school_id in (select school_id from public.user_roles where user_id = auth.uid() and role = 'school_manager')
);
create policy submissions_insert on public.submissions for insert to authenticated with check (
  public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'submission_editor')
);
create policy submissions_delete on public.submissions for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Valores
create policy submission_values_select on public.submission_values for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id and (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'submission_editor')
    or s.school_id in (select public.user_school_ids(auth.uid()))
  ))
);
create policy submission_values_write on public.submission_values for insert to authenticated with check (
  exists (select 1 from public.submissions s where s.id = submission_id and (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'submission_editor')
    or s.school_id in (select school_id from public.user_roles where user_id = auth.uid() and role = 'school_manager')
  ))
);
create policy submission_values_update on public.submission_values for update to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id and (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'submission_editor')
    or s.school_id in (select school_id from public.user_roles where user_id = auth.uid() and role = 'school_manager')
  ))
);
create policy submission_values_delete on public.submission_values for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Modelos de impressão
create policy print_templates_select on public.print_templates for select to authenticated using (
  exists (select 1 from public.forms f where f.id = form_id and (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'submission_editor')
    or f.school_id in (select public.user_school_ids(auth.uid()))
  ))
);
create policy print_templates_write on public.print_templates for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy print_templates_update on public.print_templates for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy print_templates_delete on public.print_templates for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Histórico
create policy audit_log_select on public.audit_log for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'submission_editor')
  or exists (select 1 from public.submissions s where s.id = submission_id
             and s.school_id in (select public.user_school_ids(auth.uid())))
);
create policy audit_log_insert on public.audit_log for insert to authenticated with check (actor_id = auth.uid());

-- ============================================================
-- Dados iniciais: 4 escolas (renomeie depois no sistema)
-- ============================================================
insert into public.schools (name, id_prefix, id_digits) values
  ('Escola A', 'ESCA', 4),
  ('Escola B', 'ESCB', 4),
  ('Escola C', 'ESCC', 4),
  ('Escola D', 'ESCD', 4);

-- Pronto! O primeiro usuário que se cadastrar no app será Administrador automaticamente.

-- ============================================================
-- 11) Biblioteca de templates de impressão (reutilizáveis entre escolas)
-- ============================================================
create table if not exists public.print_template_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  header_text text,
  footer_text text,
  show_logo boolean not null default false,
  columns integer not null default 1 check (columns in (1,2)),
  page_size text not null default 'A4' check (page_size in ('A4','A5')),
  show_signature boolean not null default false,
  layout jsonb,
  field_labels jsonb not null default '[]',
  school_ids uuid[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.print_template_library to authenticated;
grant all on public.print_template_library to service_role;

alter table public.print_template_library enable row level security;

create policy ptl_select on public.print_template_library for select to authenticated using (true);
create policy ptl_insert on public.print_template_library for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy ptl_update on public.print_template_library for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy ptl_delete on public.print_template_library for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Vínculo entre o modelo dentro do formulário e o template da biblioteca
alter table public.print_templates
  add column if not exists library_id uuid references public.print_template_library(id) on delete set null;
create index if not exists print_templates_library_id_idx on public.print_templates(library_id);
alter table public.opportunities add column if not exists owner_confirmed_at timestamptz null;
alter table public.opportunities add column if not exists visit_at timestamptz null;

-- Tipos de atividade das tarefas do CRM (lista editável pelo administrador)
create table if not exists public.crm_task_types (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.crm_task_types to authenticated;
grant all on public.crm_task_types to service_role;
alter table public.crm_task_types enable row level security;
create policy crm_task_types_select on public.crm_task_types for select to authenticated using (true);
create policy crm_task_types_write on public.crm_task_types for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create table if not exists public.access_logs(
  id bigserial primary key, user_id uuid, email text, event text not null,
  user_agent text, created_at timestamptz not null default now());
create index if not exists access_logs_created_idx on public.access_logs(created_at desc);
create index if not exists access_logs_user_idx on public.access_logs(user_id, created_at desc);
create table if not exists public.activity_logs(
  id bigserial primary key, actor_id uuid, actor_name text, action text not null,
  table_name text not null, record_id text, school_id uuid, label text,
  old_data jsonb, new_data jsonb, created_at timestamptz not null default now());
create index if not exists activity_logs_created_idx on public.activity_logs(created_at desc);
grant select on public.access_logs, public.activity_logs to authenticated;
grant all on public.access_logs, public.activity_logs to service_role;
grant usage on sequence public.access_logs_id_seq, public.activity_logs_id_seq to service_role;
alter table public.access_logs enable row level security;
alter table public.activity_logs enable row level security;
drop policy if exists "admin read access_logs" on public.access_logs;
create policy "admin read access_logs" on public.access_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));
drop policy if exists "admin read activity_logs" on public.activity_logs;
create policy "admin read activity_logs" on public.activity_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_old jsonb; v_new jsonb; v_row jsonb; v_actor uuid; v_name text; k text;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old) - 'updated_at'; end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new) - 'updated_at'; end if;
  if tg_op = 'UPDATE' then
    if v_old = v_new then return null; end if;
    for k in select key from jsonb_each(v_new) loop
      if v_old->k is not distinct from v_new->k then v_old := v_old - k; v_new := v_new - k; end if;
    end loop;
  end if;
  v_row := coalesce(to_jsonb(new), to_jsonb(old));
  begin v_actor := auth.uid(); exception when others then v_actor := null; end;
  if v_actor is null then
    begin v_actor := nullif(current_setting('app.actor_id', true),'')::uuid; exception when others then v_actor := null; end;
  end if;
  if v_actor is not null then select full_name into v_name from profiles where id = v_actor; end if;
  insert into activity_logs(actor_id, actor_name, action, table_name, record_id, school_id, label, old_data, new_data)
  values (v_actor, v_name, lower(tg_op), tg_table_name, v_row->>'id',
    case when (v_row->>'school_id') ~ '^[0-9a-f-]{36}$' then (v_row->>'school_id')::uuid end,
    left(coalesce(v_row->>'public_id', v_row->>'name', v_row->>'title', v_row->>'label', v_row->>'full_name', v_row->>'body', v_row->>'value', v_row->>'role'), 160),
    v_old, v_new);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['crm_close_reasons','crm_notes','crm_task_types','crm_tasks','file_categories','form_destination_rules','form_destinations','form_fields','forms','funnel_stages','funnels','legacy_datasets','opportunities','presenters','print_template_library','print_templates','profiles','schools','shared_files','submission_values','submissions','user_funnels','user_roles'] loop
    execute format('drop trigger if exists trg_log_activity on public.%I', t);
    execute format('create trigger trg_log_activity after insert or update or delete on public.%I for each row execute function public.log_activity()', t);
  end loop; end $$;

-- Troca obrigatória de senha no próximo acesso
alter table public.profiles add column if not exists must_change_password boolean not null default false;
