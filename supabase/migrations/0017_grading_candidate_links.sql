-- 0017_grading_candidate_links.sql
-- A grading candidate records a submission; its pointer to the student it
-- created was blocking that student from ever being deleted. The link now
-- clears itself, so the submission history survives without trapping the record.

alter table public.grading_candidates
  drop constraint if exists grading_candidates_created_student_id_fkey;
alter table public.grading_candidates
  add constraint grading_candidates_created_student_id_fkey
  foreign key (created_student_id) references public.students (id) on delete set null;

alter table public.grading_candidates
  drop constraint if exists grading_candidates_created_registration_id_fkey;
alter table public.grading_candidates
  add constraint grading_candidates_created_registration_id_fkey
  foreign key (created_registration_id) references public.event_registrations (id) on delete set null;
