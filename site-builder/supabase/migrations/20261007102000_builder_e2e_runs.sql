-- ELTARA — durable admin Builder E2E validation journal.
-- Service-only: customer/browser roles must never read or write operational validation evidence.

create table if not exists public.builder_e2e_runs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  locale text not null check (locale in ('fr','en')),
  include_ai boolean not null default false,
  deployment_sha text not null,
  status text not null check (status in ('running','passed','failed','cleanup_failed')),
  failed_stage text,
  detail text,
  steps jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists builder_e2e_runs_completed_idx
  on public.builder_e2e_runs (completed_at desc nulls last);

create index if not exists builder_e2e_runs_deployment_locale_idx
  on public.builder_e2e_runs (deployment_sha, locale, status, completed_at desc);

alter table public.builder_e2e_runs enable row level security;

revoke all on public.builder_e2e_runs from anon, authenticated;
grant select, insert, update, delete on public.builder_e2e_runs to service_role;
