-- A form template is either the registration form a candidate signs, or the
-- result form an examiner's marks are printed onto. They carry different fields
-- and different defaults, so they're kept apart rather than sharing one list.
--
-- (Already applied to the live project.)
alter table public.event_form_templates
  add column if not exists purpose text not null default 'registration';

alter table public.event_form_templates
  drop constraint if exists event_form_templates_purpose_check;
alter table public.event_form_templates
  add constraint event_form_templates_purpose_check check (purpose in ('registration', 'exam'));

-- One default per purpose, not one per event: an event can have a default
-- registration form and a default result form at the same time.
drop index if exists event_form_templates_one_default;
create unique index if not exists event_form_templates_one_default
  on public.event_form_templates (event_id, purpose) where is_default;
