-- 0018_access_requests_and_signatures.sql
--
-- 1. Self-service login requests, approved by a Super Admin before any account
--    exists. The chosen password is hashed at submission time.
-- 2. Waiver e-signatures. Each registration carries a random token so a signing
--    link can be shared without a login while revealing only that one entry.

create table if not exists public.access_requests (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  full_name     text not null,
  email         text not null,
  phone         text,
  club_id       uuid references public.clubs (id) on delete set null,
  club_name_raw text,
  password_hash text not null,
  message       text,
  status        text not null default 'pending',
  reviewed_by   uuid references public.app_users (id) on delete set null,
  reviewed_at   timestamptz,
  created_user_id uuid references public.app_users (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint access_requests_status_check check (status in ('pending','approved','rejected'))
);
create index if not exists access_requests_status_idx on public.access_requests (status, created_at desc);

alter table public.event_registrations
  add column if not exists waiver_token uuid not null default gen_random_uuid();
create unique index if not exists event_registrations_waiver_token_key
  on public.event_registrations (waiver_token);

create table if not exists public.waiver_signatures (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.event_registrations (id) on delete cascade,
  signed_name     text not null,
  signature_png   text not null,
  signed_at       timestamptz not null default now(),
  signed_ip       text
);

alter table public.access_requests   enable row level security;
alter table public.waiver_signatures enable row level security;
