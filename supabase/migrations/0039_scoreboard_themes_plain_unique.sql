-- Saving a scoreboard theme failed with:
--
--   there is no unique or exclusion constraint matching the ON CONFLICT
--   specification
--
-- 0038 created the index on event_id as a PARTIAL one (WHERE event_id IS NOT
-- NULL). Postgres will not use a partial index to resolve ON CONFLICT
-- (event_id) unless the statement repeats the same predicate, and a PostgREST
-- upsert never sends one. The index looked right in the schema and could not
-- be used.
--
-- A plain unique index works, and gives up nothing: Postgres treats NULLs as
-- distinct, so on its own it would allow several rows with no event -- but the
-- second index still allows only one, so the rule is unchanged.

drop index if exists public.scoreboard_themes_event_key;

create unique index if not exists scoreboard_themes_event_key
  on public.scoreboard_themes(event_id);

-- Unchanged from 0038: exactly one row with no event, as the house style.
create unique index if not exists scoreboard_themes_global_key
  on public.scoreboard_themes((true)) where event_id is null;
