-- Photos for an event's info pack, shown on the public event page too.
-- (Already applied to the live project.)
create table if not exists public.event_photos (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  storage_path text not null,
  caption      text,
  sort_order   integer not null default 0,
  uploaded_by  uuid references public.app_users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists event_photos_event_idx on public.event_photos (event_id, sort_order);
alter table public.event_photos enable row level security;

insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do update set public = true;

-- Which events a grading category is marked on. Null means all of them, so
-- existing categories keep working untouched. Junior grades sit four events;
-- the total is scaled so every candidate is still marked out of 100.
alter table public.event_categories
  add column if not exists exam_events text[];

update public.event_categories
set exam_events = array['basic_technique','pattern','step_sparring','sparring']
where type = 'grading'
  and name in ('White Yellow / Yellow Tip', 'Yellow')
  and exam_events is null;

-- Public grading registration: somebody who isn't signed in fills the form,
-- signs it, and gets a link back to their own completed PDF. The token is what
-- makes that link safe to hand out -- it points at one submission and nothing else.
alter table public.grading_candidates
  add column if not exists signature_png text,
  add column if not exists signed_name   text,
  add column if not exists signed_at     timestamptz,
  add column if not exists public_token  uuid not null default gen_random_uuid(),
  add column if not exists phone         text;

create unique index if not exists grading_candidates_public_token_idx
  on public.grading_candidates (public_token);
