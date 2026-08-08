-- Convenience view: one row per user with role code/name and a flat
-- permissions array, used by the login flow to build the session token.
create or replace view app_user_access as
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
