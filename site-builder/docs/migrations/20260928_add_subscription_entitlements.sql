-- Sprint 5A: catalogue d'offres et droits applicatifs, sans dépendance au prestataire de paiement.
create table if not exists public.subscription_plans (
  key text primary key check (key in ('free','pro')),
  name text not null,
  ai_minute_limit integer not null check (ai_minute_limit > 0),
  ai_daily_limit integer not null check (ai_daily_limit > 0),
  ai_monthly_limit integer not null check (ai_monthly_limit > 0),
  storage_mb integer not null check (storage_mb > 0),
  custom_domain boolean not null default false,
  premium_architect boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (key,name,ai_minute_limit,ai_daily_limit,ai_monthly_limit,storage_mb,custom_domain,premium_architect)
values ('free','Gratuit',5,20,80,250,false,false), ('pro','Pro',10,100,500,2048,true,true)
on conflict (key) do update set name=excluded.name, ai_minute_limit=excluded.ai_minute_limit, ai_daily_limit=excluded.ai_daily_limit, ai_monthly_limit=excluded.ai_monthly_limit, storage_mb=excluded.storage_mb, custom_domain=excluded.custom_domain, premium_architect=excluded.premium_architect;

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null references public.subscription_plans(key) default 'free',
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled','suspended')),
  provider text, provider_customer_id text, provider_subscription_id text,
  current_period_end timestamptz, updated_at timestamptz not null default now()
);
create index if not exists user_subscriptions_plan_key_idx on public.user_subscriptions(plan_key);
alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
revoke all on public.subscription_plans from anon;
revoke all on public.user_subscriptions from anon;
grant select on public.subscription_plans to authenticated;
grant select on public.user_subscriptions to authenticated;
create policy "authenticated read active plans" on public.subscription_plans for select to authenticated using (active = true);
create policy "users read own subscription" on public.user_subscriptions for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.get_my_entitlements()
returns table(plan_key text, plan_name text, ai_minute_limit integer, ai_daily_limit integer, ai_monthly_limit integer, storage_mb integer, custom_domain boolean, premium_architect boolean, subscription_status text)
language sql security invoker set search_path = ''
as $$
  select p.key,p.name,p.ai_minute_limit,p.ai_daily_limit,p.ai_monthly_limit,p.storage_mb,p.custom_domain,p.premium_architect,coalesce(s.status,'active')
  from public.subscription_plans p
  left join public.user_subscriptions s on s.user_id=(select auth.uid()) and s.plan_key=p.key
  where p.key=coalesce((select us.plan_key from public.user_subscriptions us where us.user_id=(select auth.uid()) and us.status in ('active','trialing') limit 1),'free') and p.active=true limit 1
$$;
revoke all on function public.get_my_entitlements() from public, anon;
grant execute on function public.get_my_entitlements() to authenticated, service_role;
