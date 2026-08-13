-- Grading categories are created automatically from a candidate's current grade
-- and carry type 'grading', which the original CHECK (written when only
-- competitions had categories) rejected. Every insert was failing, so grading
-- entries ended up with no category at all — which in turn left the Exam page
-- with nothing to show.
--
-- (Already applied to the live project.)
alter table public.event_categories
  drop constraint if exists event_categories_type_check;

alter table public.event_categories
  add constraint event_categories_type_check
  check (type = any (array[
    'pattern', 'sparring', 'special_event', 'power_breaking',
    'pre_arrange', 'team_pattern', 'team_sparring', 'other',
    'grading'
  ]));
