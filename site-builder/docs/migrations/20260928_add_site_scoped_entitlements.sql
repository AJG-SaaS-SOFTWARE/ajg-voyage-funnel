-- Site-scoped plan entitlements. Account-level anti-abuse counters remain global by design.
create or replace function public.get_my_site_entitlements(p_site_id uuid)
returns table(plan_key text,plan_name text,ai_minute_limit integer,ai_daily_limit integer,ai_monthly_limit integer,storage_mb integer,custom_domain boolean,premium_architect boolean,subscription_status text)
language sql security invoker set search_path='' stable as $$
 with mine as (select ss.plan_key,ss.status from public.site_subscriptions ss where ss.site_id=p_site_id and ss.owner_id=(select auth.uid())),
 fallback as (select us.plan_key,us.status from public.user_subscriptions us where us.user_id=(select auth.uid()) and exists(select 1 from public.sites s where s.id=p_site_id and s.owner_id=(select auth.uid()))),
 effective as (select coalesce((select plan_key from mine),(select plan_key from fallback),'free') plan_key,coalesce((select status from mine),(select status from fallback),'active') actual_status)
 select p.key,p.name,p.ai_minute_limit,p.ai_daily_limit,p.ai_monthly_limit,p.storage_mb,p.custom_domain,p.premium_architect,e.actual_status
 from effective e join public.subscription_plans p on p.key=case when e.actual_status in ('active','trialing','past_due') then e.plan_key else 'free' end where p.active=true limit 1
$$;
revoke all on function public.get_my_site_entitlements(uuid) from public,anon;
grant execute on function public.get_my_site_entitlements(uuid) to authenticated,service_role;
create or replace function private.consume_my_site_ai_generation_internal(p_site_id uuid)
returns text language plpgsql security definer set search_path='pg_catalog','public','private','pg_temp' as $$
declare v_user_id uuid:=auth.uid();v_now timestamptz:=now();v_minute integer;v_daily integer;v_monthly integer;
begin
 if v_user_id is null then return 'unauthorized'; end if;
 if not exists(select 1 from public.get_my_site_capabilities(p_site_id) c where c.can_generate_ai) then return 'unavailable'; end if;
 select e.ai_minute_limit,e.ai_daily_limit,e.ai_monthly_limit into v_minute,v_daily,v_monthly from public.get_my_site_entitlements(p_site_id) e limit 1;
 if v_minute is null or v_minute<1 or v_daily<1 or v_monthly<1 then return 'unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
 if (select count(*) from public.ai_usage_events where user_id=v_user_id and created_at>=v_now-interval '1 minute')>=v_minute then return 'minute_limit'; end if;
 if (select count(*) from public.ai_usage_events where user_id=v_user_id and created_at>=date_trunc('day',v_now))>=v_daily then return 'daily_limit'; end if;
 if (select count(*) from public.ai_usage_events where user_id=v_user_id and created_at>=date_trunc('month',v_now))>=v_monthly then return 'monthly_limit'; end if;
 insert into public.ai_usage_events(user_id,created_at) values(v_user_id,v_now);return 'ok';
end $$;
revoke all on function private.consume_my_site_ai_generation_internal(uuid) from public,anon,authenticated;
grant execute on function private.consume_my_site_ai_generation_internal(uuid) to authenticated,service_role;
create or replace function public.consume_my_site_ai_generation(p_site_id uuid)
returns text language sql security invoker set search_path='pg_catalog','private','pg_temp' as $$select private.consume_my_site_ai_generation_internal(p_site_id)$$;
revoke all on function public.consume_my_site_ai_generation(uuid) from public,anon;
grant execute on function public.consume_my_site_ai_generation(uuid) to authenticated,service_role;
