-- Grading exam marking.  (Already applied to the live project.)
--
-- One row per registration, created the first time an examiner saves. Scores
-- are 1-10; the three starred events are required before a student counts as
-- fully marked, which is enforced in the app rather than here so a half-finished
-- row can still be saved and picked up later by another examiner.
--
-- `locked` freezes a student's marks. Several examiners work at once, each on
-- different students, so the row is the unit of contention rather than the page.

create table if not exists public.grading_exam_scores (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null unique references public.event_registrations (id) on delete cascade,
  basic_technique  smallint,
  pattern          smallint,
  step_sparring    smallint,
  sparring         smallint,
  breaking         smallint,
  stamina          smallint,
  remark           text,
  passed           boolean,
  locked           boolean not null default false,
  locked_by        uuid references public.app_users (id) on delete set null,
  locked_at        timestamptz,
  updated_by       uuid references public.app_users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  constraint grading_scores_range check (
    (basic_technique is null or basic_technique between 1 and 10) and
    (pattern         is null or pattern         between 1 and 10) and
    (step_sparring   is null or step_sparring   between 1 and 10) and
    (sparring        is null or sparring        between 1 and 10) and
    (breaking        is null or breaking        between 1 and 10) and
    (stamina         is null or stamina         between 1 and 10)
  )
);

create index if not exists grading_exam_scores_registration_idx
  on public.grading_exam_scores (registration_id);

-- Results stay private until an organiser publishes them.
alter table public.events
  add column if not exists results_published_at timestamptz,
  add column if not exists results_published_by uuid references public.app_users (id) on delete set null;

alter table public.grading_exam_scores enable row level security;

-- Examiners' pages ping each other over a Realtime broadcast channel when marks
-- change; REPLICA IDENTITY FULL keeps the option of row-level subscriptions open
-- without another migration.
alter table public.grading_exam_scores replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'grading_exam_scores'
  ) then
    alter publication supabase_realtime add table public.grading_exam_scores;
  end if;
end $$;
