-- Make a fresh install match production, and one index that was missed.
--
-- 1. clock_remaining.
--
-- The live column is `not null default 0`; 0032_scoreboard.sql declares it
-- `int`, nullable, no default. Nobody knows which hand did that, but the
-- consequence was real: toDto read "no value stored yet" as "a full round",
-- that fallback never once fired, and every freshly created ring opened
-- showing 0:00 -- which reads as time up before anybody has begun.
--
-- The code no longer depends on either shape (it asks the ring's state, not
-- the value), so this is not a fix for a bug. It is so that an installation
-- built from these files behaves the same as the one that has been running,
-- rather than differing in a way nobody would look for.
--
-- Written as a new migration rather than by editing 0032, because 0032 has
-- already run everywhere it is ever going to run and rewriting applied history
-- makes the record dishonest. On production this is a no-op.
--
-- The rest of the schema was audited against the live database at the same
-- time -- every column, both directions -- and this was the only genuine
-- difference. Nothing is stricter in the files than in production, which is
-- the direction that would have caused a fresh install to reject data the app
-- writes.

alter table public.scoreboard_rings alter column clock_remaining set default 0;

update public.scoreboard_rings set clock_remaining = 0 where clock_remaining is null;

alter table public.scoreboard_rings alter column clock_remaining set not null;

-- 2. The foreign key the linter flagged after 0044.
--
-- event_attempts got an index on category_id and on registration_id and not on
-- event_id, which is what a cascade from events walks.
create index if not exists event_attempts_event_idx on public.event_attempts(event_id);
