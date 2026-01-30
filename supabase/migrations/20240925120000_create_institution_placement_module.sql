-- Institution placement module schema

-- Enums for constrained values
create type if not exists institution_user_role as enum ('admin', 'counselor', 'viewer');
create type if not exists funnel_stage as enum ('applied', 'shortlisted', 'interview', 'offered', 'hired', 'rejected');
create type if not exists counselling_status as enum ('scheduled', 'completed', 'cancelled');
create type if not exists risk_status as enum ('low', 'medium', 'high');
create type if not exists drive_rule_type as enum ('min_cgpa', 'min_batch_year', 'allowed_departments', 'custom');

-- Institutions (tenants)
create table if not exists institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text,
  secondary_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

comment on table institutions is 'Tenant institutions for placement and counselling modules.';
comment on column institutions.name is 'Display name of the institution (unique).';

-- Institution-scoped users
create table if not exists institution_users (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  user_id uuid not null,
  role institution_user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, user_id)
);

create index if not exists institution_users_institution_id_idx on institution_users (institution_id);

comment on table institution_users is 'Mapping between institutions and app users with scoped roles.';
comment on column institution_users.institution_id is 'FK to institutions; deletes cascade to related users.';
comment on column institution_users.user_id is 'References auth.users.id in the auth schema (not enforced here).';

-- Students
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  email text not null,
  full_name text not null,
  batch_year int not null,
  department text,
  cgpa numeric(3,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, email)
);

create index if not exists students_institution_id_idx on students (institution_id);
create index if not exists students_batch_year_idx on students (batch_year);

comment on table students is 'Student profiles scoped to an institution.';
comment on column students.institution_id is 'FK to institutions; deletes cascade to students.';

-- Placement drives
create table if not exists placement_drives (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  company_name text not null,
  title text not null,
  drive_date date not null,
  min_cgpa numeric(3,2),
  min_batch_year int,
  allowed_departments text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, company_name, title, drive_date)
);

create index if not exists placement_drives_institution_id_idx on placement_drives (institution_id);
create index if not exists placement_drives_drive_date_idx on placement_drives (drive_date);

comment on table placement_drives is 'Placement drives hosted by institutions.';
comment on column placement_drives.institution_id is 'FK to institutions; deletes cascade to drives.';

-- Drive eligibility rules (extensible rule storage)
create table if not exists drive_eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  drive_id uuid not null references placement_drives(id) on delete cascade,
  rule_type drive_rule_type not null,
  rule_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drive_eligibility_rules_drive_id_idx on drive_eligibility_rules (drive_id);

comment on table drive_eligibility_rules is 'Extensible eligibility rules attached to placement drives.';
comment on column drive_eligibility_rules.drive_id is 'FK to placement_drives; deletes cascade to rules.';

-- Student status per drive
create table if not exists drive_student_status (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  drive_id uuid not null references placement_drives(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  stage funnel_stage not null,
  status_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drive_id, student_id)
);

create index if not exists drive_student_status_institution_id_idx on drive_student_status (institution_id);
create index if not exists drive_student_status_drive_id_idx on drive_student_status (drive_id);
create index if not exists drive_student_status_student_id_idx on drive_student_status (student_id);
create index if not exists drive_student_status_stage_idx on drive_student_status (stage);

comment on table drive_student_status is 'Student funnel stage per placement drive.';
comment on column drive_student_status.drive_id is 'FK to placement_drives; deletes cascade to statuses.';
comment on column drive_student_status.student_id is 'FK to students; deletes cascade to statuses.';

-- Drive-level aggregated funnel counts (optional)
create table if not exists drive_funnel_counts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  drive_id uuid not null references placement_drives(id) on delete cascade,
  stage funnel_stage not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drive_id, stage)
);

create index if not exists drive_funnel_counts_institution_id_idx on drive_funnel_counts (institution_id);
create index if not exists drive_funnel_counts_drive_id_idx on drive_funnel_counts (drive_id);

comment on table drive_funnel_counts is 'Optional stored aggregates for drive funnel stages.';
comment on column drive_funnel_counts.drive_id is 'FK to placement_drives; deletes cascade to counts.';

-- Institution-wide batch funnel counts
create table if not exists institution_funnel_counts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  batch_year int not null,
  stage funnel_stage not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, batch_year, stage)
);

create index if not exists institution_funnel_counts_institution_id_idx on institution_funnel_counts (institution_id);
create index if not exists institution_funnel_counts_batch_year_idx on institution_funnel_counts (batch_year);

comment on table institution_funnel_counts is 'Aggregated funnel counts per institution and batch.';
comment on column institution_funnel_counts.institution_id is 'FK to institutions; deletes cascade to counts.';

-- Counselling sessions
create table if not exists counselling_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  scheduled_at timestamptz not null,
  status counselling_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists counselling_sessions_institution_id_idx on counselling_sessions (institution_id);
create index if not exists counselling_sessions_student_id_idx on counselling_sessions (student_id);
create index if not exists counselling_sessions_scheduled_at_idx on counselling_sessions (scheduled_at);

comment on table counselling_sessions is 'Scheduled counselling sessions for students.';
comment on column counselling_sessions.student_id is 'FK to students; deletes cascade to sessions.';

-- Counselling notes
create table if not exists counselling_notes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  session_id uuid references counselling_sessions(id) on delete set null,
  note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists counselling_notes_institution_id_idx on counselling_notes (institution_id);
create index if not exists counselling_notes_student_id_idx on counselling_notes (student_id);
create index if not exists counselling_notes_session_id_idx on counselling_notes (session_id);

comment on table counselling_notes is 'Notes related to counselling sessions or students.';
comment on column counselling_notes.session_id is 'Optional FK to counselling_sessions; null if general note.';

-- Student risk status
create table if not exists student_risk (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  risk_status risk_status not null,
  reason_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id)
);

create index if not exists student_risk_institution_id_idx on student_risk (institution_id);
create index if not exists student_risk_student_id_idx on student_risk (student_id);
create index if not exists student_risk_risk_status_idx on student_risk (risk_status);

comment on table student_risk is 'Current risk status for a student.';
comment on column student_risk.student_id is 'FK to students; deletes cascade to risk status.';
