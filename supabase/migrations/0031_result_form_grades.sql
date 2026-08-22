-- A result form can be tied to the grades it covers.
--
-- Different ranks are examined on different sheets and often print on different
-- paper, so an event carries several result forms and each says which grades it
-- is for. An empty list means "any grade", which is what a single general form
-- does — so nothing has to be tagged before it works.
--
-- A candidate prints on the form naming their grade; failing that, the default.
--
-- (Already applied to the live project.)
alter table public.event_form_templates
  add column if not exists grades text[] not null default '{}';

-- With per-grade forms there can be several marked default for the same
-- purpose, so the old "one default per purpose" rule no longer holds.
drop index if exists event_form_templates_one_default;
