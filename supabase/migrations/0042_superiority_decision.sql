-- Settling a bout the judges have left level.
--
-- ITF breaks a tie in two steps: an extra round first, and if the judges are
-- still level after it, a decision on superiority. Until now the app could do
-- neither -- a level bout simply refused to save, and the only way past it was
-- to edit somebody's score until the numbers came out right, which is exactly
-- the record you don't want on a disputed result.
--
-- The decision is the referee's, so it goes in against slot 0 like the warnings
-- and deductions, as its own kind. It carries no points: it only counts when
-- the judges are tied, and every press either way is kept, so a referee who
-- changes their mind leaves a trail rather than an edit.

alter table public.scoreboard_entries drop constraint if exists scoreboard_entries_kind_check;
alter table public.scoreboard_entries add constraint scoreboard_entries_kind_check
  check (kind in ('point', 'deduction', 'flag', 'warning', 'penalty', 'decision'));

-- A bout won this way reads as a draw in the vote counts alone. Recorded so a
-- result sheet can say how it was won rather than printing "2-2" beside a
-- winner's name.
alter table public.scoreboard_results add column if not exists by_decision boolean not null default false;
