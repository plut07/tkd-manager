-- Registration approval workflow: new registrations start as 'pending' and
-- must be approved by an admin/event manager before they become 'confirmed'.
alter table event_registrations
  drop constraint if exists event_registrations_status_check;

update event_registrations set status = 'pending' where status = 'registered';

alter table event_registrations
  alter column status set default 'pending';

alter table event_registrations
  add constraint event_registrations_status_check
  check (status in ('pending', 'confirmed', 'withdrawn'));
