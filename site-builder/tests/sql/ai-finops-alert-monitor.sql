begin;
set local role service_role;
do $$
declare s uuid;u uuid;c uuid:=gen_random_uuid();oldc uuid:=gen_random_uuid();used bigint;alertid bigint;
begin
  select id,owner_id into s,u from public.sites limit 1;
  if s is null then raise exception 'Site fixture missing'; end if;
  if has_function_privilege('authenticated','public.run_ai_finops_monitor()','EXECUTE') or
    has_table_privilege('anon','public.ai_finops_alerts','SELECT') then raise exception 'Client monitoring access'; end if;
  insert into public.ai_cost_reservations(call_id,request_id,user_id,site_id,plan_key,pool,operation,sequence,reserved_micros,charged_micros,state,created_at,settled_at)
  values(c,gen_random_uuid(),u,s,'essential','run','heroTitle',1,900000,900000,'settled',now(),now()),
    (oldc,gen_random_uuid(),null,null,'essential','run','heroTitle',1,9000,9000,'uncertain','2025-01-01',null);
  select sum(charged_micros) into used from public.ai_cost_reservations where state<>'settled' or coalesce(settled_at,created_at)>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  update public.ai_cost_policy set global_monthly_micros=used*4/3,global_daily_micros=1000000000000,ai_enabled=true,heavy_enabled=true;
  perform public.run_ai_finops_monitor();
  select id into alertid from public.ai_finops_alerts where scope='global' and kind='monthly' and resolved_at is null and threshold=75;
  if alertid is null then raise exception 'Global 75 percent threshold missing'; end if;
  if not exists(select 1 from public.ai_finops_alerts where scope='account' and subject_key=u::text and kind='run_monthly' and threshold>=90 and resolved_at is null) then raise exception 'Individual run threshold missing'; end if;
  if not exists(select 1 from public.ai_finops_alerts where kind='stale_provision' and resolved_at is null) then raise exception 'Previous-period provision lost'; end if;
  perform public.run_ai_finops_monitor();
  if (select count(*) from public.ai_finops_alerts where scope='global' and kind='monthly' and resolved_at is null)<>1 or
    not exists(select 1 from public.ai_finops_alerts where id=alertid and threshold=75) then raise exception 'Repeated monitor duplicated alert'; end if;
  update public.ai_cost_policy set global_monthly_micros=used*10/9;
  perform public.run_ai_finops_monitor();
  if not exists(select 1 from public.ai_finops_alerts where id=alertid and threshold=90 and level='critical') then raise exception 'Threshold escalation created another event or did not escalate'; end if;
  -- No supplier reservation is actually released by monitoring.
  if (select charged_micros from public.ai_cost_reservations where call_id=oldc)<>9000 then raise exception 'Monitor released uncertain spend'; end if;
  update public.ai_cost_reservations set state='settled',charged_micros=0,settled_at=now() where call_id in(c,oldc);
  update public.ai_cost_policy set global_monthly_micros=1000000000000;
  perform public.run_ai_finops_monitor();
  if not exists(select 1 from public.ai_finops_alerts where id=alertid and resolved_at is not null) then raise exception 'Resolved alert stayed active'; end if;
  if public.get_ai_finops_monitor_status()->>'lastRunAt' is null then raise exception 'Monitor heartbeat missing'; end if;
  update public.ai_cost_policy set heavy_enabled=false;
  perform public.run_ai_finops_monitor();
  if not exists(select 1 from public.ai_finops_alerts where kind='heavy_paused' and resolved_at is null) then raise exception 'Targeted breaker not reported'; end if;
end $$;
rollback;
