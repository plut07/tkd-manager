-- 0013_form_templates.sql
--
-- Uploadable PDF form templates with user-placed fields.
--
-- An organiser uploads their printed form, drags boxes onto a preview of it,
-- and says which piece of data belongs in each box. At print time the original
-- PDF is loaded and the values are drawn at those positions, so the output is
-- the real form rather than a re-creation of it.

-- Private bucket: the files are reached only through our own authenticated
-- route, never by a public URL.
insert into storage.buckets (id, name, public)
values ('event-templates', 'event-templates', false)
on conflict (id) do nothing;

create table if not exists public.event_form_templates (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  name         text not null,
  storage_path text not null,
  page_count   integer not null default 1,
  -- Page size in PDF points, so the designer can keep its preview to scale.
  page_width   numeric not null default 595.28,
  page_height  numeric not null default 841.89,
  is_default   boolean not null default true,
  created_by   uuid references public.app_users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Field boxes are stored as fractions of the page (0..1) rather than points, so
-- the designer's preview can be any size and the mapping still holds.
create table if not exists public.event_form_fields (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.event_form_templates (id) on delete cascade,
  field_key   text not null,
  page        integer not null default 1,
  x           numeric not null,
  y           numeric not null,
  width       numeric not null,
  height      numeric not null,
  font_size   numeric not null default 11,
  align       text not null default 'left',
  created_at  timestamptz not null default now(),
  constraint event_form_fields_align_check check (align in ('left', 'center', 'right')),
  constraint event_form_fields_bounds_check check (
    x >= 0 and x <= 1 and y >= 0 and y <= 1 and width > 0 and width <= 1 and height > 0 and height <= 1
  )
);

create index if not exists event_form_templates_event_idx on public.event_form_templates (event_id);
create index if not exists event_form_fields_template_idx on public.event_form_fields (template_id, page);

alter table public.event_form_templates enable row level security;
alter table public.event_form_fields    enable row level security;
