-- Eligible-countries gate for events. Empty array = open to every country.
alter table events
  add column if not exists allowed_countries text[] not null default '{}'::text[];
