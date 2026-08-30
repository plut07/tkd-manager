-- A build can live somewhere else.
--
-- Uploading through the browser needs NEXT_PUBLIC_SUPABASE_URL and
-- NEXT_PUBLIC_SUPABASE_ANON_KEY set on the deployment, and Supabase's own
-- storage caps a single file at 50 MB on the free plan. An APK is bigger than
-- that and the keys aren't always set, which left no way to publish at all.
--
-- So a release is now either a file in our storage or a link to one hosted
-- elsewhere -- a GitHub Release, most usefully, which has no size limit worth
-- worrying about and a permanent address. Everything downstream reads one row
-- either way.

alter table public.app_releases add column if not exists download_url text;

-- Was mandatory when a file in storage was the only kind of release there was.
alter table public.app_releases alter column storage_path drop not null;
alter table public.app_releases alter column file_name drop not null;

-- Exactly one of the two, never both and never neither. Without this a release
-- with nothing behind it saves cleanly and only fails on somebody's phone at
-- the event, which is the worst place to find out.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_releases_one_source'
  ) then
    alter table public.app_releases
      add constraint app_releases_one_source
      check ((storage_path is not null) <> (download_url is not null));
  end if;
end $$;
