-- BUILD / RUN / GROW Phase 0.
-- Growth replaces the former Pro plan. AI Launch is a separate, bounded BUILD entitlement.

alter table public.subscription_plans
  drop constraint if exists subscription_plans_key_check;

insert into public.subscription_plans
  (key,name,ai_minute_limit,ai_daily_limit,ai_monthly_limit,storage_mb,custom_domain,premium_architect,active)
select
  'growth',
  'Growth',
  ai_minute_limit,
  ai_daily_limit,
  ai_monthly_limit,
  storage_mb,
  custom_domain,
  true,
  active
from public.subscription_plans
where key='pro'
on conflict (key) do update set
  name=excluded.name,
  ai_minute_limit=excluded.ai_minute_limit,
  ai_daily_limit=excluded.ai_daily_limit,
  ai_monthly_limit=excluded.ai_monthly_limit,
  storage_mb=excluded.storage_mb,
  custom_domain=excluded.custom_domain,
  premium_architect=true,
  active=excluded.active;

update public.site_subscriptions set plan_key='growth' where plan_key='pro';
update public.user_subscriptions set plan_key='growth' where plan_key='pro';
delete from public.subscription_plans where key='pro';

alter table public.subscription_plans
  add constraint subscription_plans_key_check
  check (key in ('free','essential','growth'));

update public.subscription_plans
set name='Growth', premium_architect=true
where key='growth';

create table if not exists public.site_ai_launch_entitlements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('stripe_purchase','growth_annual','admin')),
  status text not null default 'active' check (status in ('active','consumed','revoked')),
  operations_total integer not null default 4 check (operations_total between 1 and 20),
  operations_used integer not null default 0 check (operations_used >= 0 and operations_used <= operations_total),
  external_reference text unique,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists site_ai_launch_entitlements_site_owner_idx
  on public.site_ai_launch_entitlements(site_id,owner_id,status);

alter table public.site_ai_launch_entitlements enable row level security;
revoke all on table public.site_ai_launch_entitlements from public, anon, authenticated;
grant select on table public.site_ai_launch_entitlements to authenticated;
grant select, insert, update, delete on table public.site_ai_launch_entitlements to service_role;

drop policy if exists site_ai_launch_entitlements_select_own on public.site_ai_launch_entitlements;
create policy site_ai_launch_entitlements_select_own
on public.site_ai_launch_entitlements
for select
to authenticated
using ((select auth.uid()) = owner_id);

create table if not exists public.site_ai_launch_operations (
  request_id uuid primary key,
  entitlement_id uuid not null references public.site_ai_launch_entitlements(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('site_create','site_revision')),
  created_at timestamptz not null default now()
);

create index if not exists site_ai_launch_operations_site_idx
  on public.site_ai_launch_operations(site_id,created_at desc);

alter table public.site_ai_launch_operations enable row level security;
revoke all on table public.site_ai_launch_operations from public, anon, authenticated;
grant select, insert, update, delete on table public.site_ai_launch_operations to service_role;

create or replace function public.get_my_site_entitlements(p_site_id uuid)
returns table(
  plan_key text,
  plan_name text,
  ai_minute_limit integer,
  ai_daily_limit integer,
  ai_monthly_limit integer,
  storage_mb integer,
  custom_domain boolean,
  premium_architect boolean,
  subscription_status text
)
language sql
stable
security invoker
set search_path=''
as $$
  with owned as (
    select exists(
      select 1 from public.sites s
      where s.id=p_site_id and s.owner_id=(select auth.uid())
    ) ok
  ),
  mine as (
    select ss.plan_key,ss.status
    from public.site_subscriptions ss
    where ss.site_id=p_site_id
      and ss.owner_id=(select auth.uid())
  ),
  fallback as (
    select us.plan_key,us.status
    from public.user_subscriptions us
    where us.user_id=(select auth.uid())
      and (select ok from owned)
    limit 1
  ),
  effective as (
    select
      case
        when (select ok from owned) and public.has_active_beta_access() then 'growth'
        else coalesce((select plan_key from mine),(select plan_key from fallback),'free')
      end plan_key,
      case
        when (select ok from owned) and public.has_active_beta_access() then 'active'
        else coalesce((select status from mine),(select status from fallback),'active')
      end actual_status
  )
  select
    p.key,p.name,p.ai_minute_limit,p.ai_daily_limit,p.ai_monthly_limit,
    p.storage_mb,p.custom_domain,p.premium_architect,e.actual_status
  from effective e
  join public.subscription_plans p
    on p.key=case
      when e.actual_status in ('active','trialing','past_due') then e.plan_key
      else 'free'
    end
  where p.active=true
    and (select ok from owned)
  limit 1
$$;

revoke all on function public.get_my_site_entitlements(uuid) from public, anon;
grant execute on function public.get_my_site_entitlements(uuid) to authenticated, service_role;

create or replace function public.get_my_entitlements()
returns table(
  plan_key text,
  plan_name text,
  ai_minute_limit integer,
  ai_daily_limit integer,
  ai_monthly_limit integer,
  storage_mb integer,
  custom_domain boolean,
  premium_architect boolean,
  subscription_status text
)
language sql
stable
security invoker
set search_path=''
as $$
  with mine as (
    select us.plan_key,us.status
    from public.user_subscriptions us
    where us.user_id=(select auth.uid())
    limit 1
  ),
  effective as (
    select
      case
        when public.has_active_beta_access() then 'growth'
        else coalesce((select plan_key from mine),'free')
      end plan_key,
      case
        when public.has_active_beta_access() then 'active'
        else coalesce((select status from mine),'active')
      end actual_status
  )
  select
    p.key,p.name,p.ai_minute_limit,p.ai_daily_limit,p.ai_monthly_limit,
    p.storage_mb,p.custom_domain,p.premium_architect,e.actual_status
  from effective e
  join public.subscription_plans p
    on p.key=case
      when e.actual_status in ('active','trialing','past_due') then e.plan_key
      else 'free'
    end
  where p.active=true
  limit 1
$$;

revoke all on function public.get_my_entitlements() from public, anon;
grant execute on function public.get_my_entitlements() to authenticated, service_role;

create or replace function public.get_my_site_ai_access(p_site_id uuid)
returns table(
  can_create_site boolean,
  can_revise_site boolean,
  access_source text,
  launch_operations_remaining integer
)
language sql
stable
security invoker
set search_path=''
as $$
  with owned as (
    select exists(
      select 1 from public.sites s
      where s.id=p_site_id and s.owner_id=(select auth.uid())
    ) ok
  ),
  entitlement as (
    select e.plan_key,e.subscription_status
    from public.get_my_site_entitlements(p_site_id) e
    limit 1
  ),
  launch as (
    select coalesce(sum(greatest(0,l.operations_total-l.operations_used)),0)::integer remaining
    from public.site_ai_launch_entitlements l
    where l.site_id=p_site_id
      and l.owner_id=(select auth.uid())
      and l.status='active'
      and (l.expires_at is null or l.expires_at > now())
  ),
  flags as (
    select
      (select ok from owned) owned,
      public.has_active_beta_access() beta,
      coalesce((select plan_key='growth' and subscription_status in ('active','trialing','past_due') from entitlement),false) growth,
      coalesce((select remaining from launch),0) launch_remaining
  )
  select
    owned and (beta or launch_remaining>0) as can_create_site,
    owned and (beta or growth or launch_remaining>0) as can_revise_site,
    case
      when not owned then 'none'
      when beta then 'beta'
      when launch_remaining>0 and growth then 'growth_launch'
      when launch_remaining>0 then 'ai_launch'
      when growth then 'growth'
      else 'none'
    end as access_source,
    case when owned then launch_remaining else 0 end
  from flags
$$;

revoke all on function public.get_my_site_ai_access(uuid) from public, anon;
grant execute on function public.get_my_site_ai_access(uuid) to authenticated, service_role;
