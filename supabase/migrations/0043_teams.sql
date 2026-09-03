-- Team events.
--
-- ITF runs team patterns and team sparring, and this app could name those
-- categories but had no way to enter anybody for them: a registration was one
-- student, so a team of five could only be entered as five separate
-- competitors who would then be drawn against each other.
--
-- A team is modelled as a registration rather than as a thing of its own. That
-- is the whole trick: everything downstream already works on registrations --
-- the draw, the seeding that keeps clubmates apart, competition numbers, the
-- scoreboard, results, the CSV export -- and none of it has to learn what a
-- team is. It is simply a competitor whose name comes from a team sheet
-- instead of from a student record.
--
-- The alternative, a separate teams table with matches pointing at either kind
-- of entrant, would have made every one of those places ask "which sort is
-- this?" forever after.

alter table public.event_registrations
  add column if not exists is_team boolean not null default false,
  add column if not exists team_name text;

-- A team registration has no single student behind it.
alter table public.event_registrations alter column student_id drop not null;

-- One or the other, never both and never neither. Without this a registration
-- with nothing behind it saves cleanly and only goes wrong in the draw, which
-- is the worst place to find out.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'event_registrations_person_or_team') then
    alter table public.event_registrations
      add constraint event_registrations_person_or_team
      check (
        (is_team = false and student_id is not null)
        or (is_team = true and team_name is not null and student_id is null)
      );
  end if;
end $$;

-- Who is on the team.
--
-- Position is the order they appear on the team sheet, which for team patterns
-- is also where they stand. Reserves are carried because ITF allows
-- substitutes, and a reserve who never competes still had to be registered,
-- weighed and insured like everybody else.
create table if not exists public.event_team_members (
  registration_id uuid not null references public.event_registrations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  position int not null default 1,
  is_reserve boolean not null default false,
  primary key (registration_id, student_id)
);

create index if not exists event_team_members_registration_idx
  on public.event_team_members(registration_id);
create index if not exists event_team_members_student_idx
  on public.event_team_members(student_id);

alter table public.event_team_members enable row level security;
-- No policies: read and written by the server with the service key, like
-- everything else here.
