-- A grading candidate's category is worked out from their current grade, and
-- settled again when their entry is approved so a corrected grade is picked up.
--
-- This flag records that somebody chose the category by hand instead. An
-- organiser's decision outranks the automatic one, so approval leaves those
-- entries alone.
--
-- (Already applied to the live project.)
alter table public.event_registrations
  add column if not exists category_locked boolean not null default false;
