alter table public.support_operations_runs
  add column if not exists platform_status text not null default 'unknown'
    check (platform_status in ('healthy','attention','failed','unknown')),
  add column if not exists platform_repaired integer not null default 0 check (platform_repaired >= 0),
  add column if not exists platform_failed integer not null default 0 check (platform_failed >= 0),
  add column if not exists platform_actions jsonb not null default '[]'::jsonb,
  add column if not exists backup_status_after text;
