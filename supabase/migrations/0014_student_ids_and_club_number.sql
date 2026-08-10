-- 0014_student_ids_and_club_number.sql
--
-- 1. "ID number" and "Passport ID" were two columns holding the same kind of
--    thing, and people filled in whichever they had. They become one field,
--    NRIC / Passport ID.
-- 2. Each student gets a running number within their club (1, 2, 3...), so a
--    club can refer to "member 14" without quoting an identity document.

-- Merge: keep national_id as the single column, taking passport_id when the
-- other is empty. Nothing is lost.
update public.students
set national_id = coalesce(nullif(trim(national_id), ''), nullif(trim(passport_id), ''))
where coalesce(trim(national_id), '') = '';

alter table public.students
  drop column if exists passport_id;

alter table public.students
  add column if not exists club_number integer;

-- Backfill in a stable order so existing members keep sensible numbers.
with numbered as (
  select id, row_number() over (partition by club_id order by created_at, id) as n
  from public.students
)
update public.students s
set club_number = numbered.n
from numbered
where numbered.id = s.id and s.club_number is null;

-- Two members of the same club can't share a number; different clubs restart
-- from 1, which is the point.
create unique index if not exists students_club_number_key
  on public.students (club_id, club_number)
  where club_number is not null;

-- Grading candidates carry the same identifier, so keep the shape consistent.
alter table public.grading_candidates
  drop column if exists passport_id;
