-- How an event's scoreboard looks.
--
-- One row per event, and one row with no event as the house style everything
-- falls back to. Kept as a single jsonb blob rather than a column per setting:
-- this is presentation, it will grow, and adding a colour shouldn't mean a
-- migration and a deploy before anybody can use it.

create table if not exists public.scoreboard_themes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- One theme per event, and only one global default.
create unique index if not exists scoreboard_themes_event_key
  on public.scoreboard_themes(event_id) where event_id is not null;
create unique index if not exists scoreboard_themes_global_key
  on public.scoreboard_themes((true)) where event_id is null;

alter table public.scoreboard_themes enable row level security;
-- No policies: read and written by the server, like everything else here.
