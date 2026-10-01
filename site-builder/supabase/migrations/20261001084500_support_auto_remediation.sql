-- AJG Site Builder — auditable safe support auto-remediation.
create table if not exists public.support_remediation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  ticket_id uuid references public.support_tickets(id) on delete set null,
  action text not null check (action in ('managed_domain_repair')),
  trigger_source text not null check (trigger_source in ('client','system','admin')),
  status text not null check (status in ('succeeded','no_change','failed')),
  result_code text not null check (char_length(result_code) between 1 and 120),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_remediation_runs_user_created_idx
  on public.support_remediation_runs(user_id, created_at desc);
create index if not exists support_remediation_runs_site_created_idx
  on public.support_remediation_runs(site_id, created_at desc);
create index if not exists support_remediation_runs_status_created_idx
  on public.support_remediation_runs(status, created_at desc);

alter table public.support_remediation_runs enable row level security;
revoke all on public.support_remediation_runs from anon;
revoke insert, update, delete on public.support_remediation_runs from authenticated;
grant select on public.support_remediation_runs to authenticated;

drop policy if exists "users read own support remediation runs" on public.support_remediation_runs;
create policy "users read own support remediation runs"
on public.support_remediation_runs for select to authenticated
using (
  user_id=(select auth.uid())
  or exists(
    select 1 from public.user_roles r
    where r.user_id=(select auth.uid()) and r.role='admin'
  )
);

comment on table public.support_remediation_runs is
  'Audit trail for deterministic support repairs. Browser roles are read-only; repairs are executed by trusted server routes only.';
