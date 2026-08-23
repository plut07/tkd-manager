-- What the hall needs to see, and what the referee needs to press.
--
-- The pattern being performed and the competitor numbers so the display can
-- name what people are watching rather than just showing two colours.

alter table public.scoreboard_rings add column if not exists pattern_name text;
alter table public.scoreboard_rings add column if not exists red_number text;
alter table public.scoreboard_rings add column if not exists blue_number text;

-- Warnings and deductions come from the referee, not from a judge. They are
-- recorded against slot 0 -- no judge is slot 0 -- and count against every
-- judge's mark alike, because they are a ruling on the bout rather than one
-- judge's opinion of it. Three warnings make a point; a deduction is a point
-- straight away.
--
-- 'deduction' already meant a judge's pattern fault press, so the referee's
-- one is 'penalty' to keep the two apart.

alter table public.scoreboard_entries drop constraint if exists scoreboard_entries_judge_slot_check;
alter table public.scoreboard_entries add constraint scoreboard_entries_judge_slot_check
  check (judge_slot >= 0 and judge_slot <= 9);

alter table public.scoreboard_entries drop constraint if exists scoreboard_entries_kind_check;
alter table public.scoreboard_entries add constraint scoreboard_entries_kind_check
  check (kind in ('point', 'deduction', 'flag', 'warning', 'penalty'));
