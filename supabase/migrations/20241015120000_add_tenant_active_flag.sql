alter table tenants
  add column if not exists is_active boolean not null default true;

create policy "Public can read tenants"
  on tenants
  for select
  using (true);
