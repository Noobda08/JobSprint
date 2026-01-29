create extension if not exists "pgcrypto";

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tenant_slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug)
);

create table if not exists superadmins (
  user_id uuid primary key references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  constraint tenant_users_role_check check (role in ('admin', 'member'))
);

create index if not exists tenants_tenant_slug_idx on tenants(tenant_slug);
create index if not exists tenant_users_tenant_user_idx on tenant_users(tenant_id, user_id);

create or replace function is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from superadmins
    where user_id = auth.uid()
  );
$$;

create or replace function is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_users
    where tenant_id = target_tenant_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

alter table tenants enable row level security;
alter table superadmins enable row level security;
alter table tenant_users enable row level security;

create policy "Superadmins can manage tenants"
  on tenants
  for all
  using (is_superadmin())
  with check (is_superadmin());

create policy "Superadmins can read superadmins"
  on superadmins
  for select
  using (is_superadmin());

create policy "Superadmins can manage tenant users"
  on tenant_users
  for all
  using (is_superadmin())
  with check (is_superadmin());

create policy "Tenant admins can manage tenant users"
  on tenant_users
  for all
  using (is_tenant_admin(tenant_id))
  with check (is_tenant_admin(tenant_id));

create policy "Users can read their memberships"
  on tenant_users
  for select
  using (user_id = auth.uid());
