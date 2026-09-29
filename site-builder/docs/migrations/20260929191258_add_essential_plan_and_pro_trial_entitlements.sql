alter table public.subscription_plans
  drop constraint if exists subscription_plans_key_check;

alter table public.subscription_plans
  add constraint subscription_plans_key_check
  check (key in ('free','essential','pro'));

insert into public.subscription_plans
  (key,name,ai_minute_limit,ai_daily_limit,ai_monthly_limit,storage_mb,custom_domain,premium_architect,active)
values
  ('essential','Essentiel',8,60,250,1024,true,false,true)
on conflict (key) do update set
  name=excluded.name,
  ai_minute_limit=excluded.ai_minute_limit,
  ai_daily_limit=excluded.ai_daily_limit,
  ai_monthly_limit=excluded.ai_monthly_limit,
  storage_mb=excluded.storage_mb,
  custom_domain=excluded.custom_domain,
  premium_architect=excluded.premium_architect,
  active=excluded.active;

update public.subscription_plans
set name='Pro IA'
where key='pro';

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
  ),
  base as (
    select e.plan_key,e.actual_status,p.*
    from effective e
    join public.subscription_plans p
      on p.key=case
        when e.actual_status in ('active','trialing','past_due') then e.plan_key
        else 'free'
      end
    where p.active=true
      and (select ok from owned)
    limit 1
  ),
  pro as (
    select *
    from public.subscription_plans
    where key='pro' and active=true
    limit 1
  )
  select
    b.plan_key,
    b.name,
    case when b.actual_status='trialing' then pro.ai_minute_limit else b.ai_minute_limit end,
    case when b.actual_status='trialing' then pro.ai_daily_limit else b.ai_daily_limit end,
    case when b.actual_status='trialing' then pro.ai_monthly_limit else b.ai_monthly_limit end,
    case when b.actual_status='trialing' then pro.storage_mb else b.storage_mb end,
    case when b.actual_status='trialing' then pro.custom_domain else b.custom_domain end,
    case when b.actual_status='trialing' then pro.premium_architect else b.premium_architect end,
    b.actual_status
  from base b
  cross join pro
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
        else coalesce((select plan_key from mine),'free')
      end plan_key,
      case
        when public.has_active_beta_access() then 'active'
        else coalesce((select status from mine),'active')
      end actual_status
  ),
  base as (
    select e.plan_key,e.actual_status,p.*
    from effective e
    join public.subscription_plans p
      on p.key=case
        when e.actual_status in ('active','trialing','past_due') then e.plan_key
        else 'free'
      end
    where p.active=true
    limit 1
  ),
  pro as (
    select *
    from public.subscription_plans
    where key='pro' and active=true
    limit 1
  )
  select
    b.plan_key,
    b.name,
    case when b.actual_status='trialing' then pro.ai_minute_limit else b.ai_minute_limit end,
    case when b.actual_status='trialing' then pro.ai_daily_limit else b.ai_daily_limit end,
    case when b.actual_status='trialing' then pro.ai_monthly_limit else b.ai_monthly_limit end,
    case when b.actual_status='trialing' then pro.storage_mb else b.storage_mb end,
    case when b.actual_status='trialing' then pro.custom_domain else b.custom_domain end,
    case when b.actual_status='trialing' then pro.premium_architect else b.premium_architect end,
    b.actual_status
  from base b
  cross join pro
$$;

revoke all on function public.get_my_entitlements() from public, anon;
grant execute on function public.get_my_entitlements() to authenticated, service_role;
