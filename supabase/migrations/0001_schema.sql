-- TKD Manager: core schema
create extension if not exists "pgcrypto";

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  category text not null,
  action text not null,
  description text
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  city text,
  country text,
  contact_email text,
  contact_phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  full_name text not null,
  email text,
  role_id uuid not null references roles(id),
  club_id uuid references clubs(id),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_app_users_role on app_users(role_id);
create index if not exists idx_app_users_club on app_users(club_id);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  email text,
  birthday date,
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  gup smallint check (gup between 1 and 10),
  dan smallint check (dan between 1 and 9),
  gender text check (gender in ('male','female','other')),
  nationality text,
  national_id text,
  passport_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_students_club on students(club_id);
create index if not exists idx_students_name on students(last_name, first_name);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discipline text,
  start_date date not null,
  end_date date,
  venue text,
  city text,
  country text,
  organizer text,
  description text,
  registration_deadline date,
  status text not null default 'upcoming' check (status in ('draft','upcoming','ongoing','completed','cancelled')),
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_events_start on events(start_date);
create index if not exists idx_events_status on events(status);

create table if not exists event_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  type text check (type in ('sparring','patterns','special_technique','power_test','team','other')),
  gender text check (gender in ('male','female','mixed','open')),
  age_min int,
  age_max int,
  weight_min numeric(5,2),
  weight_max numeric(5,2),
  belt_level text,
  sort_order int not null default 0
);
create index if not exists idx_event_categories_event on event_categories(event_id);

create table if not exists event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  category_id uuid references event_categories(id) on delete set null,
  club_id uuid not null references clubs(id),
  status text not null default 'registered' check (status in ('registered','confirmed','withdrawn')),
  registered_at timestamptz not null default now(),
  unique (event_id, student_id, category_id)
);
create index if not exists idx_event_registrations_event on event_registrations(event_id);
create index if not exists idx_event_registrations_club on event_registrations(club_id);

create table if not exists event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  url text not null,
  uploaded_at timestamptz not null default now()
);
create index if not exists idx_event_documents_event on event_documents(event_id);

-- keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_users_updated on app_users;
create trigger trg_app_users_updated before update on app_users
  for each row execute function set_updated_at();

drop trigger if exists trg_students_updated on students;
create trigger trg_students_updated before update on students
  for each row execute function set_updated_at();

drop trigger if exists trg_events_updated on events;
create trigger trg_events_updated before update on events
  for each row execute function set_updated_at();

-- RLS: the app only ever talks to Postgres with the Supabase service_role key
-- (server-side only, never exposed to the browser), which bypasses RLS by
-- design. We still enable RLS with no public policies so that the anon/
-- authenticated keys can never read or write anything if they were ever
-- used by mistake.
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table clubs enable row level security;
alter table app_users enable row level security;
alter table students enable row level security;
alter table events enable row level security;
alter table event_categories enable row level security;
alter table event_registrations enable row level security;
alter table event_documents enable row level security;
