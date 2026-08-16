-- Fine alignment for a form template.
--
-- The designer now rasterises the real page with pdf.js, so the overlay is 1:1
-- and these stay at zero. They exist for the fallback preview, where the
-- browser's own PDF viewer pads the page inside its frame and everything lands
-- shifted: one correction per form beats nudging every field.
--
-- Stored as fractions of the page, matching how field boxes are stored.
--
-- (Already applied to the live project.)
alter table public.event_form_templates
  add column if not exists offset_x numeric not null default 0,
  add column if not exists offset_y numeric not null default 0,
  add column if not exists scale    numeric not null default 1;
