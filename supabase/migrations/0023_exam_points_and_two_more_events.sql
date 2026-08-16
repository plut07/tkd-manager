-- Back to points, and eight events rather than six.
--
-- Zero is a real mark, not "unscored", so the range starts at 0 and an unmarked
-- event is null. Eight events at ten points each is 80 raw, which the app
-- multiplies by 1.25 to present a mark out of 100; above 50 is a pass, which an
-- examiner can still override with the Passed tick.
--
-- (Already applied to the live project.)
alter table public.grading_exam_scores
  alter column basic_technique type smallint using (case when basic_technique then 10 else null end),
  alter column pattern         type smallint using (case when pattern         then 10 else null end),
  alter column step_sparring   type smallint using (case when step_sparring   then 10 else null end),
  alter column sparring        type smallint using (case when sparring        then 10 else null end),
  alter column breaking        type smallint using (case when breaking        then 10 else null end),
  alter column stamina         type smallint using (case when stamina         then 10 else null end);

alter table public.grading_exam_scores
  add column if not exists self_defend       smallint,
  add column if not exists knife_self_defend smallint;

alter table public.grading_exam_scores
  drop constraint if exists grading_scores_range;

alter table public.grading_exam_scores
  add constraint grading_scores_range check (
    (basic_technique   is null or basic_technique   between 0 and 10) and
    (pattern           is null or pattern           between 0 and 10) and
    (step_sparring     is null or step_sparring     between 0 and 10) and
    (sparring          is null or sparring          between 0 and 10) and
    (breaking          is null or breaking          between 0 and 10) and
    (stamina           is null or stamina           between 0 and 10) and
    (self_defend       is null or self_defend       between 0 and 10) and
    (knife_self_defend is null or knife_self_defend between 0 and 10)
  );
