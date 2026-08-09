-- 0010_uppercase_student_names.sql
-- Student names are now stored in capitals so lists, exports and printed
-- registration sheets read consistently. New records are uppercased by the
-- form, the spreadsheet importer and the Tally intake; this brings existing
-- rows into line.
--
-- Safe to run more than once: rows already in capitals are left untouched.

update public.students
set first_name = upper(first_name),
    last_name  = upper(last_name)
where first_name <> upper(first_name)
   or last_name  <> upper(last_name);

-- Candidates waiting for approval become students on approval, so normalise
-- them too rather than letting a stale row reintroduce mixed case.
update public.grading_candidates
set first_name = upper(first_name),
    last_name  = upper(last_name)
where first_name <> upper(first_name)
   or last_name  <> upper(last_name);
