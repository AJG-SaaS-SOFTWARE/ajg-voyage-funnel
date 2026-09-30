begin;
set local role service_role;
do $$
declare s uuid;u uuid;r uuid:=gen_random_uuid();c uuid:=gen_random_uuid();l uuid:=gen_random_uuid();
  op text:='finops_history_'||gen_random_uuid()::text;
  report jsonb;stats jsonb;before_launch integer;
begin
  select id,owner_id into s,u from public.sites limit 1;
  if s is null then raise exception 'Site fixture missing'; end if;
  if has_function_privilege('anon','public.reserve_ai_provider_budget_with_model(uuid,uuid,uuid,uuid,text,text,text,integer,bigint,text)','EXECUTE') or
    has_function_privilege('authenticated','public.snapshot_ai_request_outcome()','EXECUTE') then raise exception 'Client snapshot access'; end if;

  insert into public.ai_request_admissions(request_id,user_id,site_id,operation,fingerprint,state,created_at)
    values(r,u,s,op,repeat('a',64),'started','2025-03-10');
  insert into public.ai_cost_reservations(call_id,request_id,user_id,site_id,plan_key,pool,operation,sequence,reserved_micros,charged_micros,state,created_at,settled_at)
    values(c,r,u,s,'growth','run',op,1,100,100,'settled','2025-03-10','2025-03-10');
  if (select root_state from public.ai_cost_reservations where call_id=c)<>'started' then raise exception 'Context not copied'; end if;
  perform public.finish_ai_request(r,u,'completed');
  delete from public.ai_request_admissions where request_id=r;
  update public.ai_cost_reservations set user_id=null,site_id=null where call_id=c;
  report:=public.ai_finops_monthly_report('2025-03-01');
  select value into stats from jsonb_array_elements(report->'requests') where value->>'operation'=op;
  if stats is null or (stats->>'measuredSuccesses')::integer<>1 or (stats->>'meanMicros')::numeric<>100 then
    raise exception 'Cleanup/anonymization erased financial statistics: %',stats;
  end if;

  before_launch:=(report->'launchRights'->>'completedRights')::integer;
  insert into public.site_ai_launch_entitlements(id,site_id,owner_id,source,operations_total,operations_used)
    values(l,s,u,'admin',1,0);
  insert into public.ai_cost_reservations(call_id,request_id,user_id,site_id,launch_id,plan_key,pool,operation,sequence,reserved_micros,charged_micros,state,created_at,settled_at)
    values(gen_random_uuid(),gen_random_uuid(),u,s,l,'essential','launch',op,1,100,100,'settled','2025-03-10','2025-03-10');
  update public.site_ai_launch_entitlements set operations_used=1 where id=l;
  delete from public.site_ai_launch_entitlements where id=l;
  if (public.ai_finops_monthly_report('2025-03-01')->'launchRights'->>'completedRights')::integer<>before_launch+1 then
    raise exception 'Entitlement deletion erased completed BUILD cost';
  end if;
  if public.reserve_ai_provider_budget_with_model(gen_random_uuid(),gen_random_uuid(),u,s,'essential','run','heroTitle',1,1,'')<>'invalid_provider_model' then raise exception 'Invalid model accepted'; end if;
  c:=gen_random_uuid();
  if public.reserve_ai_provider_budget_with_model(c,gen_random_uuid(),u,s,'essential','run','heroTitle',1,1,'gpt-5.6-luna')<>'ok' then raise exception 'Model-aware admission failed'; end if;
  if (select requested_model from public.ai_cost_reservations where call_id=c)<>'gpt-5.6-luna' then raise exception 'Requested model missing'; end if;
  perform public.settle_ai_provider_budget(c,0,'settled');
end $$;
rollback;
