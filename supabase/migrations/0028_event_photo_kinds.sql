-- Event photos now have jobs rather than all being gallery shots.
--
--   background  sits behind the public event page
--   header      the highlight image: the event card in the list, and the
--               banner across the top of the event page
--   gallery     everything else, shown as a grid
--
-- Existing photos become gallery, which is what they were.
--
-- (Already applied to the live project.)
alter table public.event_photos
  add column if not exists kind text not null default 'gallery';

alter table public.event_photos
  drop constraint if exists event_photos_kind_check;
alter table public.event_photos
  add constraint event_photos_kind_check check (kind in ('background', 'header', 'gallery'));

-- One background and one header per event: a second upload replaces the first
-- rather than leaving the page to pick between them.
create unique index if not exists event_photos_one_background
  on public.event_photos (event_id) where kind = 'background';
create unique index if not exists event_photos_one_header
  on public.event_photos (event_id) where kind = 'header';
