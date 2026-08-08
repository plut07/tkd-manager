-- Permissions catalogue
insert into permissions (code, category, action, description) values
  ('user:create',    'user',    'create', 'Create user accounts'),
  ('user:edit',       'user',    'edit',   'Edit user accounts'),
  ('user:delete',     'user',    'delete', 'Delete user accounts'),
  ('user:view',       'user',    'view',   'View user accounts'),
  ('event:create',    'event',   'create', 'Create events'),
  ('event:edit',      'event',   'edit',   'Edit events'),
  ('event:delete',    'event',   'delete', 'Delete events'),
  ('event:view',      'event',   'view',   'View events'),
  ('student:create',  'student', 'create', 'Create students'),
  ('student:edit',    'student', 'edit',   'Edit students'),
  ('student:delete',  'student', 'delete', 'Delete students'),
  ('student:view',    'student', 'view',   'View students')
on conflict (code) do nothing;

-- Roles
insert into roles (code, name, description, is_system) values
  ('super_admin',   'Super Admin',   'Full access to every module, including user and access-right management.', true),
  ('event_manager',  'Event Manager', 'Manages events end-to-end and can view students across all clubs. Cannot manage user accounts.', true),
  ('club_admin',      'Club User',     'Manages their own club''s students and can view events.', true)
on conflict (code) do nothing;

-- Super Admin: every permission
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.code = 'super_admin'
on conflict do nothing;

-- Event Manager: full event control + read-only students across clubs
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.code in ('event:create','event:edit','event:delete','event:view','student:view')
where r.code = 'event_manager'
on conflict do nothing;

-- Club User: manage own club's students + view events
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.code in ('student:create','student:edit','student:delete','student:view','event:view')
where r.code = 'club_admin'
on conflict do nothing;

-- Seed Super Admin login.
-- Username: Admin  Password: SuperAdmin@225588
-- Change this password after first login (Users > Admin > Edit).
insert into app_users (username, password_hash, full_name, role_id, active)
select 'Admin', crypt('SuperAdmin@225588', gen_salt('bf', 10)), 'Super Administrator',
       (select id from roles where code = 'super_admin'), true
where not exists (select 1 from app_users where username = 'Admin');
