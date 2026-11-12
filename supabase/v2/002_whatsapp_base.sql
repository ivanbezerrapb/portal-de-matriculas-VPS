-- Portal de Matrículas v2 — Fase 1
-- Base do WhatsApp: instâncias (Evolution API hoje, API oficial da Meta depois),
-- contatos, conversas e mensagens recebidas pelo webhook.
--
-- Migração aditiva e idempotente. Tudo que é escrito pelo webhook e pelas
-- server functions usa a service role; as políticas abaixo controlam apenas
-- o que o navegador pode LER.

-- ---------- Instâncias ----------
create table if not exists public.whatsapp_instances (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                       -- nome exibido no portal
  provider        text not null default 'evolution'
                  check (provider in ('evolution', 'meta')),
  external_name   text not null unique,                -- instanceName na Evolution
  school_id       uuid null references public.schools(id) on delete set null, -- null = todas as unidades
  status          text not null default 'close'
                  check (status in ('close', 'connecting', 'open')),
  phone           text null,                           -- número conectado (só dígitos)
  profile_name    text null,
  qr_base64       text null,                           -- último QR Code recebido
  qr_updated_at   timestamptz null,
  last_event_at   timestamptz null,
  active          boolean not null default true,
  created_by      uuid null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Segredos da instância: SEM política de leitura, só a service role acessa.
create table if not exists public.whatsapp_instance_secrets (
  instance_id     uuid primary key references public.whatsapp_instances(id) on delete cascade,
  token           text null,                           -- token (hash) da instância na Evolution
  webhook_secret  text not null,                       -- conferido em cada chamada do webhook
  updated_at      timestamptz not null default now()
);

-- ---------- Contatos ----------
create table if not exists public.wa_contacts (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null unique,                    -- só dígitos, com DDI (ex.: 5583999990000)
  name        text null,                               -- nome editado no portal
  push_name   text null,                               -- nome que vem do WhatsApp
  avatar_url  text null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Conversas ----------
create table if not exists public.wa_conversations (
  id                    uuid primary key default gen_random_uuid(),
  instance_id           uuid not null references public.whatsapp_instances(id) on delete cascade,
  contact_id            uuid not null references public.wa_contacts(id) on delete cascade,
  remote_jid            text not null,
  status                text not null default 'pending'
                        check (status in ('pending', 'open', 'closed')),
  assigned_to           uuid null,                     -- atendente (Fase 2)
  opportunity_id        uuid null references public.opportunities(id) on delete set null, -- card (Fase 3)
  unread_count          integer not null default 0,
  last_message_at       timestamptz null,
  last_message_preview  text null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (instance_id, remote_jid)
);
create index if not exists wa_conversations_last_idx on public.wa_conversations (last_message_at desc);
create index if not exists wa_conversations_assigned_idx on public.wa_conversations (assigned_to);

-- ---------- Mensagens ----------
create table if not exists public.wa_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.wa_conversations(id) on delete cascade,
  instance_id      uuid not null references public.whatsapp_instances(id) on delete cascade,
  external_id      text not null,                      -- id da mensagem no WhatsApp
  direction        text not null check (direction in ('in', 'out')),
  type             text not null default 'text',       -- text, image, audio, video, document, sticker, location, contact, other
  body             text null,
  media_mime       text null,
  media_path       text null,                          -- arquivo no Storage (Fase 2)
  status           text null,                          -- pending, sent, delivered, read, failed
  sent_by          uuid null,                          -- usuário do portal que enviou
  sent_at          timestamptz not null default now(),
  raw              jsonb null,
  created_at       timestamptz not null default now(),
  unique (instance_id, external_id)
);
create index if not exists wa_messages_conv_idx on public.wa_messages (conversation_id, sent_at);

-- ---------- RLS ----------
alter table public.whatsapp_instances        enable row level security;
alter table public.whatsapp_instance_secrets enable row level security;
alter table public.wa_contacts               enable row level security;
alter table public.wa_conversations          enable row level security;
alter table public.wa_messages               enable row level security;

-- Instâncias: admin vê todas; demais usuários veem as da própria unidade (ou sem unidade).
drop policy if exists whatsapp_instances_select on public.whatsapp_instances;
create policy whatsapp_instances_select on public.whatsapp_instances
  for select to authenticated using (
    public.has_role(auth.uid(), 'admin')
    or school_id is null
    or school_id in (select public.user_school_ids(auth.uid()))
  );

-- Contatos, conversas e mensagens: por enquanto só o admin lê pelo navegador.
-- A Fase 2 (caixa de atendimento) amplia para os atendentes da instância.
drop policy if exists wa_contacts_select on public.wa_contacts;
create policy wa_contacts_select on public.wa_contacts
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists wa_conversations_select on public.wa_conversations;
create policy wa_conversations_select on public.wa_conversations
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists wa_messages_select on public.wa_messages;
create policy wa_messages_select on public.wa_messages
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- whatsapp_instance_secrets: nenhuma política de propósito.

revoke all on public.whatsapp_instance_secrets from anon, authenticated;
