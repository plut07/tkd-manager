-- 0012_club_instructor.sql
-- Each club records its instructor, shown on the club list and used on printed
-- forms (the waiver has a "Name of Instructor" line).

alter table public.clubs
  add column if not exists instructor_name text;
