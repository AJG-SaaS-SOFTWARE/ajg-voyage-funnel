begin;
set local role service_role;
do $$
declare
  s uuid; u uuid; r1 uuid:=gen_random_uuid(); r2 uuid:=gen_random_uuid();
  r3 uuid:=gen_random_uuid(); r4 uuid:=gen_random_uuid();
  op text:='finops_test_'||gen_random_uuid()::text;
  stats jsonb; report jsonb; d jsonb;
begin
  select id,owner_id into s,u from public.sites limit 1;
  if s is null then raise exception 'Site fixture missing'; end if;
  if has_function_privilege('anon','public.ai_finops_monthly_report(date)','EXECUTE') or
    has_function_privilege('authenticated','public.ai_finops_monthly_report(date)','EXECUTE') then
    raise exception 'Client reporting access';
  end if;
  insert into public.ai_request_admissions(request_id,user_id,site_id,operation,fingerprint,state,created_at)
  values (r1,u,s,op,repeat('a',64),'completed','2025-01-10'),
    (r2,u,s,op,repeat('b',64),'completed','2025-01-10'),
    (r3,u,s,op,repeat('c',64),'completed','2025-01-10'),
    (r4,u,s,op,repeat('d',64),'failed','2025-01-10');
  insert into public.ai_cost_reservations(call_id,request_id,user_id,site_id,plan_key,pool,operation,sequence,reserved_micros,charged_micros,state,created_at,settled_at)
  values (gen_random_uuid(),r1,u,s,op,'run',op,1,100,100,'settled','2025-01-10','2025-01-10'),
    (gen_random_uuid(),r1,u,s,op,'run',op,2,300,300,'settled','2025-01-10','2025-01-10'),
    (gen_random_uuid(),r2,u,s,op,'run',op,1,800,800,'settled','2025-01-10','2025-01-10'),
    (gen_random_uuid(),r3,u,s,op,'run',op,1,900,900,'uncertain','2025-01-10','2025-01-10'),
    (gen_random_uuid(),r4,u,s,op,'run',op,1,200,200,'settled','2025-01-10','2025-01-10');
  insert into public.ai_cost_reservations(call_id,request_id,user_id,site_id,plan_key,pool,operation,sequence,reserved_micros,charged_micros,state,created_at,settled_at)
  select gen_random_uuid(),gen_random_uuid(),null,null,op,'run',op,1,1,1,'settled','2025-01-10','2025-01-10' from generate_series(1,1100);
  report:=public.ai_finops_monthly_report('2025-01-01');
  select value into d from jsonb_array_elements(report->'dimensions'->'plan'->'rows') where value->>'key'=op;
  if (d->>'costMicros')::bigint<>3400 or (d->>'calls')::bigint<>1105 then raise exception 'Aggregate truncated or double counted: %',d; end if;
  select value into stats from jsonb_array_elements(report->'requests') where value->>'operation'=op;
  if (stats->>'measuredSuccesses')::bigint<>2 or (stats->>'meanMicros')::numeric<>600
    or (stats->>'p95Micros')::bigint<>800 or (stats->>'failedCostMicros')::bigint<>200 then
    raise exception 'Request grouping or unknown exclusion incorrect: %',stats;
  end if;
  if (select count(*) from jsonb_array_elements(public.ai_finops_monthly_report('2025-02-01')->'dimensions'->'plan'->'rows') where value->>'key'=op)>0 then raise exception 'Month leaked'; end if;
end $$;
rollback;
