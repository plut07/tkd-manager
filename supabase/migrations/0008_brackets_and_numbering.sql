-- Competitor numbering (per event) and knockout bracket/scoring tables.

alter table event_registrations
  add column if not exists competition_number text;

create unique index if not exists idx_event_registrations_competition_number
  on event_registrations(event_id, competition_number)
  where competition_number is not null;

create table if not exists event_category_brackets (
  id uuid primary key default gen_random_uuid(),
  event_category_id uuid not null unique references event_categories(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','published')),
  generated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists event_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category_id uuid not null references event_categories(id) on delete cascade,
  round text not null,
  slot int not null,
  competitor1_registration_id uuid references event_registrations(id) on delete set null,
  competitor2_registration_id uuid references event_registrations(id) on delete set null,
  competitor1_points smallint,
  competitor2_points smallint,
  winner_registration_id uuid references event_registrations(id) on delete set null,
  next_match_id uuid references event_matches(id) on delete set null,
  next_slot smallint,
  loser_next_match_id uuid references event_matches(id) on delete set null,
  loser_next_slot smallint,
  is_third_place boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_event_matches_category on event_matches(category_id);
create index if not exists idx_event_matches_event on event_matches(event_id);

drop trigger if exists trg_event_matches_updated on event_matches;
create trigger trg_event_matches_updated before update on event_matches
  for each row execute function set_updated_at();

alter table event_category_brackets enable row level security;
alter table event_matches enable row level security;
