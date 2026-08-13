-- Grading exams are marked pass/fail per event rather than out of ten, so the
-- six score columns become plain ticks. The table held no marks yet, so this is
-- a straight conversion.
--
-- (Already applied to the live project.)
alter table public.grading_exam_scores
  drop constraint if exists grading_scores_range;

alter table public.grading_exam_scores
  alter column basic_technique type boolean using (basic_technique is not null and basic_technique > 0),
  alter column pattern         type boolean using (pattern         is not null and pattern         > 0),
  alter column step_sparring   type boolean using (step_sparring   is not null and step_sparring   > 0),
  alter column sparring        type boolean using (sparring        is not null and sparring        > 0),
  alter column breaking        type boolean using (breaking        is not null and breaking        > 0),
  alter column stamina         type boolean using (stamina         is not null and stamina         > 0);

-- Why a form submission needs a person to look at it: the NRIC matches somebody
-- already on file but the name doesn't, or the form arrived without an ID or a
-- name at all. Previously these were silently merged into the existing student
-- or dropped without trace.
alter table public.grading_candidates
  add column if not exists review_note text;
