-- Beta Tester is an access grant, never a paid subscription.
-- Rights expire automatically at expires_at and then fall back to the real plan.

create table if not exists public.beta_access_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  granted_by uuid null references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beta_access_grants_valid_window check (expires_at > starts_at)
);

alter table public.beta_access_grants enable row level security;

revoke all on table public.beta_access_grants from public, anon, authenticated;
grant select, insert, update, delete on table public.beta_access_grants to service_role;

create or replace function public.get_my_beta_access()
returns table(
  active boolean,
  starts_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select
    (
      g.active
      and g.starts_at <= now()
      and g.expires_at > now()
    ) as active,
    g.starts_at,
    g.expires_at
  from public.beta_access_grants g
  where g.user_id = (select auth.uid())
  limit 1
$$;

revoke all on function public.get_my_beta_access() from public, anon;
grant execute on function public.get_my_beta_access() to authenticated, service_role;

create or replace function public.has_active_beta_access()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(
    (
      select
        g.active
        and g.starts_at <= now()
        and g.expires_at > now()
      from public.beta_access_grants g
      where g.user_id = (select auth.uid())
      limit 1
    ),
    false
  )
$$;

revoke all on function public.has_active_beta_access() from public, anon;
grant execute on function public.has_active_beta_access() to authenticated, service_role;

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
        when (select ok from owned) and public.has_active_beta_access() then 'pro'
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
        when public.has_active_beta_access() then 'pro'
        when coalesce((select status from mine),'active') in ('active','trialing','past_due')
          then coalesce((select plan_key from mine),'free')
        else 'free'
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
  join public.subscription_plans p on p.key=e.plan_key
  where p.active=true
  limit 1
$$;

revoke all on function public.get_my_entitlements() from public, anon;
grant execute on function public.get_my_entitlements() to authenticated, service_role;
