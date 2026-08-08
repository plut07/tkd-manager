-- Event type: Competition / Grading / Seminar / Course
alter table events
  add column if not exists event_type text not null default 'competition';

alter table events
  drop constraint if exists events_event_type_check;
alter table events
  add constraint events_event_type_check
  check (event_type in ('competition','grading','seminar','course'));

-- Expanded category eligibility criteria
alter table event_categories
  add column if not exists gup_list smallint[] not null default '{}'::smallint[];
alter table event_categories
  add column if not exists dan_list smallint[] not null default '{}'::smallint[];
alter table event_categories
  add column if not exists gender_list text[] not null default '{}'::text[];

-- Loosen the type check before remapping old values, then re-apply the
-- expanded vocabulary used by the competition category builder.
alter table event_categories
  drop constraint if exists event_categories_type_check;

update event_categories set type = 'pattern' where type = 'patterns';
update event_categories set type = 'special_event' where type = 'special_technique';
update event_categories set type = 'power_breaking' where type = 'power_test';
update event_categories set type = 'team_pattern' where type = 'team';

alter table event_categories
  add constraint event_categories_type_check
  check (type in (
    'pattern','sparring','special_event','power_breaking',
    'pre_arrange','team_pattern','team_sparring','other'
  ));
