-- 0009_grading_tally.sql
-- Grading registration pipeline backed by Tally.so forms.
--
-- Flow: an organizer creates a Tally form for a grading event. Tally posts each
-- submission to /api/grading-webhook, which either (a) matches an existing student
-- by national ID / passport and registers them, or (b) stages a candidate row for
-- Super Admin approval, which then creates the student profile.
--
-- All access is via the service role key, so RLS is enabled with no policies
-- (matching the rest of the schema) to block anon/authenticated clients outright.

-- One Tally form per grading event.
create table if not exists public.grading_forms (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  tally_form_id  text not null,
  form_url       text not null,
  edit_url       text,
  signing_secret text not null,
  created_by     uuid references public.app_users (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint grading_forms_event_id_key unique (event_id)
);

-- One row per sync/webhook delivery, for an audit trail of what came in when.
create table if not exists public.grading_import_batches (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  imported_by   uuid references public.app_users (id) on delete set null,
  row_count     integer not null default 0,
  matched_count integer not null default 0,
  new_count     integer not null default 0,
  imported_at   timestamptz not null default now()
);

-- Registrants who could not be matched to an existing student record.
-- A Super Admin assigns a club and approves, which creates the student.
create table if not exists public.grading_candidates (
  id                      uuid primary key default gen_random_uuid(),
  batch_id                uuid not null references public.grading_import_batches (id) on delete cascade,
  event_id                uuid not null references public.events (id) on delete cascade,
  first_name              text not null,
  last_name               text not null,
  email                   text,
  birthday                date,
  gender                  text,
  weight_kg               numeric,
  height_cm               numeric,
  gup                     smallint,
  dan                     smallint,
  nationality             text,
  national_id             text,
  passport_id             text,
  club_name_raw           text,
  matched_club_id         uuid references public.clubs (id) on delete set null,
  status                  text not null default 'pending',
  reviewed_by             uuid references public.app_users (id) on delete set null,
  reviewed_at             timestamptz,
  created_student_id      uuid references public.students (id) on delete set null,
  created_registration_id uuid references public.event_registrations (id) on delete set null,
  created_at              timestamptz not null default now(),
  constraint grading_candidates_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

-- Webhook dedupe + the "awaiting approval" list are both keyed on these.
create index if not exists grading_candidates_event_status_idx
  on public.grading_candidates (event_id, status);
create index if not exists grading_candidates_event_national_id_idx
  on public.grading_candidates (event_id, national_id);
create index if not exists grading_import_batches_event_idx
  on public.grading_import_batches (event_id, imported_at desc);

alter table public.grading_forms          enable row level security;
alter table public.grading_import_batches enable row level security;
alter table public.grading_candidates     enable row level security;
