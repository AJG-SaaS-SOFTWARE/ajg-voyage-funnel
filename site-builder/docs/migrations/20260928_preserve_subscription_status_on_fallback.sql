create or replace function public.get_my_entitlements()
returns table(plan_key text,plan_name text,ai_minute_limit integer,ai_daily_limit integer,ai_monthly_limit integer,storage_mb integer,custom_domain boolean,premium_architect boolean,subscription_status text)
language sql security invoker set search_path='' as $$
 with mine as (
   select us.plan_key,us.status from public.user_subscriptions us where us.user_id=(select auth.uid()) limit 1
 ), effective as (
   select case when coalesce((select status from mine),'active') in ('active','trialing','past_due') then coalesce((select plan_key from mine),'free') else 'free' end as plan_key,
          coalesce((select status from mine),'active') as actual_status
 )
 select p.key,p.name,p.ai_minute_limit,p.ai_daily_limit,p.ai_monthly_limit,p.storage_mb,p.custom_domain,p.premium_architect,e.actual_status
 from effective e join public.subscription_plans p on p.key=e.plan_key where p.active=true limit 1
$$;
revoke all on function public.get_my_entitlements() from public,anon;
grant execute on function public.get_my_entitlements() to authenticated,service_role;

-- past_due keeps the subscribed plan during the J0-J14 grace period; per-site capabilities block AI immediately and other mutations at J14.
