-- Detached paid BUILD quota. Apply AFTER 20261012_detached_ai_launch_build_only.sql.
-- The one-shot entitlement is not RUN; allow only bounded premium creation to use
-- the shared anti-abuse quota even when the free plan has zero AI allowance.
-- No publication or standard text AI rights are granted.
create or replace function private.reserve_my_site_ai_generation_internal(
  p_site_id uuid,p_request_id uuid
) returns text
language plpgsql security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_user_id uuid:=auth.uid();
  v_now timestamptz:=now();
  v_minute integer; v_daily integer; v_monthly integer;
  v_plan text; v_access boolean:=false;
begin
  if v_user_id is null then return 'unauthorized'; end if;
  if p_site_id is null or p_request_id is null then return 'invalid_request'; end if;
  if not exists(select 1 from public.sites s
    where s.id=p_site_id and s.owner_id=v_user_id and s.privacy_state='active')
    then return 'unavailable'; end if;
  if exists(select 1 from public.ai_usage_events
    where user_id=v_user_id and site_id=p_site_id and request_id=p_request_id)
    then return 'ok'; end if;
  if not exists(select 1 from public.get_my_site_capabilities(p_site_id) c
    where c.can_generate_ai) then return 'unavailable'; end if;

  select e.plan_key,e.ai_minute_limit,e.ai_daily_limit,e.ai_monthly_limit
  into v_plan,v_minute,v_daily,v_monthly
  from public.get_my_site_entitlements(p_site_id) e limit 1;

  if v_plan='free' then
    select exists(select 1 from public.site_ai_launch_entitlements l
      where l.site_id=p_site_id and l.owner_id=v_user_id
        and l.source='stripe_purchase' and l.status='active'
        and l.operations_total>l.operations_used
        and (l.expires_at is null or l.expires_at>v_now))
    into v_access;
    if not v_access then return 'unavailable'; end if;
    -- Conservative anti-burst, lifetime BUILD allowance is checked separately
    -- by reserve_my_site_launch_operation before the provider is called.
    v_minute:=1; v_daily:=4; v_monthly:=12;
  end if;
  if v_minute is null or v_minute<1 or v_daily<1 or v_monthly<1
    then return 'unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
  if (select count(*) from public.ai_usage_events
      where user_id=v_user_id and created_at>=v_now-interval '1 minute')>=v_minute
      then return 'minute_limit'; end if;
  if (select count(*) from public.ai_usage_events
      where user_id=v_user_id and created_at>=date_trunc('day',v_now))>=v_daily
      then return 'daily_limit'; end if;
  if (select count(*) from public.ai_usage_events
      where user_id=v_user_id and created_at>=date_trunc('month',v_now))>=v_monthly
      then return 'monthly_limit'; end if;
  insert into public.ai_usage_events(user_id,site_id,request_id,created_at)
  values(v_user_id,p_site_id,p_request_id,v_now);
  return 'ok';
exception when unique_violation then
  -- Do not grant a successful reservation for a different site/request owner.
  if exists(select 1 from public.ai_usage_events
    where user_id=v_user_id and site_id=p_site_id and request_id=p_request_id)
    then return 'ok'; end if;
  return 'unavailable';
end
$$;
revoke all on function private.reserve_my_site_ai_generation_internal(uuid,uuid)
  from public,anon,authenticated;
grant execute on function private.reserve_my_site_ai_generation_internal(uuid,uuid)
  to authenticated,service_role;
