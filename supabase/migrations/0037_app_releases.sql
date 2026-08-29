-- Where the judge app's APK file lives, so referees can install it from a link
-- rather than being sent a file over WhatsApp.
--
-- Expo's own build links expire after about a month, which is no good for
-- something handed out at every event — so the file is copied here once and
-- served from an address that doesn't change.

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'android' check (platform in ('android', 'ios')),
  version text not null,
  notes text,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null default 0,
  -- Exactly one release per platform is the one people are offered. Older ones
  -- are kept so a build that turns out to be broken can be rolled back by
  -- pointing at the previous file rather than rebuilding under pressure.
  is_current boolean not null default true,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid
);

create index if not exists app_releases_current_idx on public.app_releases(platform, is_current, uploaded_at desc);

alter table public.app_releases enable row level security;
-- No policies: written by the server with the service key, and read by the
-- download page through the server, like everything else here.

-- Private bucket. The download page asks the server for a short-lived link
-- rather than exposing the storage address, which is the same arrangement the
-- form templates use.
insert into storage.buckets (id, name, public)
values ('app-releases', 'app-releases', false)
on conflict (id) do nothing;
