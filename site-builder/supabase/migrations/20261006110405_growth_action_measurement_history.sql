create table if not exists public.site_growth_actions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null check (opportunity_key in ('cta','form','acquisition')),
  page_path text null check (page_path is null or char_length(page_path) <= 200),
  score integer not null check (score between 0 and 100),
  impact text not null check (impact in ('high','medium')),
  confidence text not null check (confidence in ('high','medium')),
  baseline_days integer not null check (baseline_days between 7 and 90),
  baseline_start date not null,
  baseline_end date not null,
  baseline_views bigint not null default 0 check (baseline_views >= 0),
  baseline_actions bigint not null default 0 check (baseline_actions >= 0),
  baseline_action_rate numeric(6,2) not null default 0 check (baseline_action_rate >= 0),
  status text not null default 'planned' check (status in ('planned','published','cancelled')),
  started_at timestamptz not null default now(),
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (baseline_start <= baseline_end),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create unique index if not exists site_growth_actions_one_planned_per_site
  on public.site_growth_actions(site_id)
  where status = 'planned';

create index if not exists site_growth_actions_owner_site_created_idx
  on public.site_growth_actions(owner_id, site_id, created_at desc);

alter table public.site_growth_actions enable row level security;
revoke all on table public.site_growth_actions from anon, authenticated;
grant select, insert, update on table public.site_growth_actions to authenticated;

drop policy if exists "owners can read growth actions" on public.site_growth_actions;
create policy "owners can read growth actions"
  on public.site_growth_actions for select to authenticated
  using ((select auth.uid()) = owner_id and exists (
    select 1 from public.sites s where s.id = site_growth_actions.site_id and s.owner_id = (select auth.uid())
  ));

drop policy if exists "owners can create growth actions" on public.site_growth_actions;
create policy "owners can create growth actions"
  on public.site_growth_actions for insert to authenticated
  with check ((select auth.uid()) = owner_id and exists (
    select 1 from public.sites s where s.id = site_growth_actions.site_id and s.owner_id = (select auth.uid())
  ));

drop policy if exists "owners can update growth actions" on public.site_growth_actions;
create policy "owners can update growth actions"
  on public.site_growth_actions for update to authenticated
  using ((select auth.uid()) = owner_id and exists (
    select 1 from public.sites s where s.id = site_growth_actions.site_id and s.owner_id = (select auth.uid())
  ))
  with check ((select auth.uid()) = owner_id and exists (
    select 1 from public.sites s where s.id = site_growth_actions.site_id and s.owner_id = (select auth.uid())
  ));

comment on table public.site_growth_actions is
  'Growth optimization actions explicitly started by site owners. Stores baseline metrics and the publication marker used for deterministic before/after measurement.';
