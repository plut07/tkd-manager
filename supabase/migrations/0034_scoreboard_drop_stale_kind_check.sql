-- The original scoreboard_entries table was created with its kind check named
-- scoreboard_kind_check, not the name Postgres generates. 0033 dropped the
-- generated name, added the wider list under it, and left the original one
-- standing -- so every warning and deduction was still being rejected by a
-- constraint nobody was looking at, and the button appeared to do nothing.
--
-- Two checks on one column is always this bug waiting to happen: the strictest
-- wins and the other looks correct.
alter table public.scoreboard_entries drop constraint if exists scoreboard_kind_check;
