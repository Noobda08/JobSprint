-- Create extensions
create extension if not exists "pgcrypto";

-- Applications table for kanban cards
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  company text not null,
  role text not null,
  link text,
  status text not null default 'research',
  notes text,
  job_description text,
  resume_version text,
  saved_at timestamptz,
  applied_date date,
  source text,
  platform text,
  screening_replied boolean,
  assessment_due date,
  info_shared text,
  interviewing_rounds jsonb,
  ctc text,
  joining_date date,
  offer_status text,
  rejection_reason text,
  rejection_date date,
  questions jsonb,
  fit_score integer,
  fit_matches jsonb,
  fit_missing jsonb,
  gmail_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_user_id_idx on applications(user_id);
create unique index if not exists applications_user_gmail_msg_uidx on applications(user_id, gmail_message_id) where gmail_message_id is not null;

-- Gmail integrations table
create table if not exists gmail_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  gmail_address text not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  last_history_id text,
  watch_expiration timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_address)
);

create index if not exists gmail_integrations_user_idx on gmail_integrations(user_id);

-- trigger helper to keep updated_at current
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists applications_set_updated_at on applications;
create trigger applications_set_updated_at
before update on applications
for each row
execute procedure set_updated_at();

drop trigger if exists gmail_integrations_set_updated_at on gmail_integrations;
create trigger gmail_integrations_set_updated_at
before update on gmail_integrations
for each row
execute procedure set_updated_at();
