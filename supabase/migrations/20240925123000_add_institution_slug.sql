-- Add slug to institutions for institute login lookups

alter table if not exists institutions
  add column if not exists slug text;

update institutions
set slug = lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g'))
where slug is null;

alter table if not exists institutions
  alter column slug set not null;

create unique index if not exists institutions_slug_key on institutions (slug);

comment on column institutions.slug is 'URL-friendly unique slug used for institute login lookups.';
