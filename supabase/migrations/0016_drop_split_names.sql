-- 0016_drop_split_names.sql
--
-- Run this only AFTER the build using full_name is live. Migration 0015 added
-- and populated full_name while leaving first_name/last_name in place so the
-- previously-deployed code kept working during the changeover. Once nothing
-- reads them, they can go.

alter table public.students
  drop column if exists first_name,
  drop column if exists last_name;

alter table public.grading_candidates
  drop column if exists first_name,
  drop column if exists last_name;

-- full_name is required from here on.
update public.students set full_name = 'UNNAMED' where coalesce(trim(full_name), '') = '';
alter table public.students alter column full_name set not null;
