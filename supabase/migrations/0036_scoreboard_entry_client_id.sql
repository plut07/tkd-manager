-- Idempotent presses, for judges scoring from a phone.
--
-- A phone that loses signal mid-press retries when it comes back, and it has
-- no way to know whether the first attempt landed. So the device names each
-- press itself and the name is unique: a retry of a press that already arrived
-- is refused by the database rather than counted twice.
--
-- Nullable, because presses made from the web judge page are sent once over a
-- connection that either worked or visibly didn't, and need no name.

alter table public.scoreboard_entries add column if not exists client_id text;

create unique index if not exists scoreboard_entries_client_id_key
  on public.scoreboard_entries(client_id)
  where client_id is not null;
