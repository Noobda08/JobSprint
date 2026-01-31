-- Creator users for platform admin portal
create table if not exists creator_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  role text not null default 'super_admin',
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email),
  constraint creator_users_role_check check (role in ('super_admin', 'admin'))
);

comment on table creator_users is 'Platform creator/admin users for managing tenants.';
comment on column creator_users.role is 'super_admin or admin.';

-- Institution licenses (one per institution)
create table if not exists institution_licenses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  plan text not null,
  seats int not null default 1,
  valid_until date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id),
  constraint institution_licenses_status_check check (status in ('active', 'inactive'))
);

comment on table institution_licenses is 'Licenses per institution tenant.';
comment on column institution_licenses.plan is 'Plan name (pilot, standard, enterprise).';

-- Track active state for institution-scoped users
alter table if exists institution_users
  add column if not exists is_active boolean not null default true;
