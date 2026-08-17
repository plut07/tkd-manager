-- Marking moves to the federation's own sheet: six components, each with its
-- own sub-columns and its own share of the 100 marks.
--
--   Fundamental      Hand / Foot                                    15
--   Pattern          Saju Jirugi ... Choong-Moo (11)                40
--   Step-Sparring    Sambo Matsogi, Ilbo Matsogi, Self Defence      10
--   Sparring         1st, 2nd, 3rd round                            20
--   Power Breaking   3 methods x 3 attempts                         10
--   Attitude / Characteristic                                        5
--
-- Individual marks live in `marks` as a flat key -> value map rather than forty
-- columns: the sheet's shape belongs to the app, and patterns are added to the
-- syllabus more often than a migration is worth. The map also carries what was
-- broken for each power-breaking row. `total` is stored so result lists and
-- exports don't have to re-add everything.
--
-- The eight old score columns are left in place; they hold a couple of test
-- rows and nothing writes to them now.
--
-- (Already applied to the live project.)
alter table public.grading_exam_scores
  add column if not exists marks              jsonb not null default '{}'::jsonb,
  add column if not exists total              numeric,
  add column if not exists examiner_signature text,
  add column if not exists examiner_name      text,
  add column if not exists approved_rank      text;

alter table public.grading_exam_scores
  drop constraint if exists grading_remark_length;
alter table public.grading_exam_scores
  add constraint grading_remark_length check (remark is null or char_length(remark) <= 300);

-- Categories now choose which *components* they are marked on, not which of the
-- old eight events, so the previous values are cleared back to "all".
update public.event_categories set exam_events = null where exam_events is not null;
