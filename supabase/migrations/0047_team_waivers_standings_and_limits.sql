-- Three things the last audit listed as decisions rather than bugs.

-- 1. A team's waivers.
--
-- A waiver is signed by a person, and a team registration has no single person
-- behind it -- so a team of five had no waiver at all, and the only way to get
-- their signed forms was to enter all five separately as individuals as well.
--
-- The signature now names which member signed. One row per member, so a team
-- collects five and the sheet is complete when everybody on it has signed.
--
-- The old unique-per-registration constraint has to go for that, and is
-- replaced by two: one signature per member on a team, and still exactly one on
-- an individual entry. The second needs a partial index rather than a plain
-- unique, because NULLs do not compare equal in SQL -- (reg, null) twice would
-- not collide, and an individual could sign the same waiver over and over.

alter table public.waiver_signatures
  add column if not exists student_id uuid references public.students(id) on delete cascade;

alter table public.waiver_signatures drop constraint if exists waiver_signatures_registration_id_key;

create unique index if not exists waiver_signatures_team_member_key
  on public.waiver_signatures(registration_id, student_id)
  where student_id is not null;

create unique index if not exists waiver_signatures_individual_key
  on public.waiver_signatures(registration_id)
  where student_id is null;

create index if not exists waiver_signatures_student_idx
  on public.waiver_signatures(student_id);

-- 2. Counting guesses rather than keystrokes.
--
-- The join-code limit counted failed attempts per address. At a venue that is
-- one address for the whole hall, so a handful of judges fumbling the code
-- between them could lock out every phone on the wifi -- the limit punishing
-- exactly the people it exists to serve.
--
-- What it is actually defending against is enumeration: somebody working
-- through the code space tries many *different* codes. A hall full of judges
-- mistyping produces a few, over and over. So the count is now of distinct
-- wrong codes, which separates the two cases cleanly and lets an honest venue
-- retype as often as it likes.

alter table public.join_code_attempts
  add column if not exists codes text[] not null default '{}';

-- 3. Standings that can be watched while they happen.
--
-- A fought division's bracket goes public when the organiser publishes it, and
-- the hall can follow along. A power test or special technique had no
-- equivalent: nothing was visible until the whole event's results were
-- published, which is usually the following week.
alter table public.event_categories
  add column if not exists standings_public boolean not null default false;
