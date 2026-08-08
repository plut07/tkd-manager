-- Fix advisor findings: pin the trigger function's search_path, and make
-- the login-lookup view run with the querying role's privileges rather
-- than the view owner's (defense in depth; the app only ever queries
-- through the service_role key, which bypasses RLS regardless).

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop view if exists app_user_access;
create view app_user_access with (security_invoker = true) as
select
  u.id as user_id,
  u.username,
  u.password_hash,
  u.full_name,
  u.email,
  u.active,
  u.club_id,
  r.code as role_code,
  r.name as role_name,
  coalesce(array_agg(p.code) filter (where p.code is not null), '{}') as permissions
from app_users u
join roles r on r.id = u.role_id
left join role_permissions rp on rp.role_id = r.id
left join permissions p on p.id = rp.permission_id
group by u.id, u.username, u.password_hash, u.full_name, u.email, u.active, u.club_id, r.code, r.name;
