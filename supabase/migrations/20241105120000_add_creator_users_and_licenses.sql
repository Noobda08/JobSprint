create table if not exists creator_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  role text not null default 'super_admin',
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);

create table if not exists institution_licenses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  plan text not null,
  seats int not null default 1,
  valid_until date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id)
);

alter table if not exists institution_users
  add column if not exists is_active boolean not null default true;
