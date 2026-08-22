-- A syllabus now belongs to a grade, not just an event.
--
-- A white belt and a 3rd Dan are examined on different things, so each grade
-- being taken can carry its own components and marks. `grade_value` holds the
-- grade code the candidate is grading *to* (G10..G1, D1..D9); a null row is the
-- event's fallback, used by any grade without one of its own.
--
-- An event's existing syllabus becomes that fallback, so nothing needs redoing.
--
-- (Already applied to the live project.)
alter table public.exam_syllabus
  add column if not exists grade_value text;

-- The old "one row per event" rule has to go before per-grade rows can exist.
alter table public.exam_syllabus
  drop constraint if exists exam_syllabus_event_id_key;

drop index if exists exam_syllabus_event_grade;
create unique index exam_syllabus_event_grade
  on public.exam_syllabus (event_id, grade_value) where grade_value is not null;

-- Still only one fallback per event.
drop index if exists exam_syllabus_event_default;
create unique index exam_syllabus_event_default
  on public.exam_syllabus (event_id) where grade_value is null;
