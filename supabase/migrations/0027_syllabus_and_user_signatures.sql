-- The marking sheet becomes editable rather than fixed in code.
--
-- One row per event holds that event's components, their contents and their
-- marks. No row means "use the built-in syllabus", so nothing has to be set up
-- before an event can be marked.
--
-- (Already applied to the live project.)
create table if not exists public.exam_syllabus (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null unique references public.events (id) on delete cascade,
  sheet      jsonb not null,
  updated_by uuid references public.app_users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.exam_syllabus enable row level security;

-- An examiner signs once on their own account rather than redrawing their
-- signature on every candidate's sheet.
alter table public.app_users
  add column if not exists signature_png text;
