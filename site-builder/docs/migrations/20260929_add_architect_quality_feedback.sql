create table if not exists public.architect_quality_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  proposal_key uuid not null,
  verdict text not null check (verdict in ('positive','negative')),
  reason text check (
    reason is null or reason in (
      'need_mismatch','copy','structure','design','generic','other'
    )
  ),
  attempt_kind text not null check (attempt_kind in ('first','regeneration')),
  audit_score integer not null default 0 check (audit_score between 0 and 100),
  refinement_applied boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, proposal_key)
);

create index if not exists architect_quality_feedback_site_created_idx
  on public.architect_quality_feedback(site_id, created_at desc);
create index if not exists architect_quality_feedback_user_created_idx
  on public.architect_quality_feedback(user_id, created_at desc);

alter table public.architect_quality_feedback enable row level security;
revoke all on table public.architect_quality_feedback from anon, authenticated;
grant insert on table public.architect_quality_feedback to authenticated;
grant select, insert on table public.architect_quality_feedback to service_role;

drop policy if exists "users insert architect quality feedback"
  on public.architect_quality_feedback;
create policy "users insert architect quality feedback"
  on public.architect_quality_feedback
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.sites s
      where s.id = site_id
        and s.owner_id = (select auth.uid())
    )
  );

comment on table public.architect_quality_feedback is
  'Structured Premium Architect evaluation only. No customer brief, generated copy or free-text content is stored.';
