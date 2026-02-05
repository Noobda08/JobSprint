alter table if exists placement_drives
  add column if not exists status text not null default 'upcoming';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'placement_drives_status_check'
  ) then
    alter table placement_drives
      add constraint placement_drives_status_check
      check (status in ('upcoming', 'completed'));
  end if;
end $$;
