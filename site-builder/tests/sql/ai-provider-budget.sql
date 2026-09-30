begin;
set local role service_role;
do $$
declare s uuid; u uuid; c uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); result text;
begin
  select id,owner_id into s,u from public.sites limit 1;
  if s is null then raise exception 'Site fixture missing'; end if;
  if has_function_privilege('authenticated','public.reserve_ai_provider_budget(uuid,uuid,uuid,uuid,text,text,text,integer,bigint)','EXECUTE') then raise exception 'Client admission access'; end if;
  if has_table_privilege('anon','public.ai_cost_reservations','SELECT') then raise exception 'Anonymous ledger access'; end if;
  result:=public.reserve_ai_provider_budget(c,r,u,s,'essential','run','heroTitle',1,1000);
  if result<>'ok' then raise exception 'Expected admission, got %',result; end if;
  if public.reserve_ai_provider_budget(c,r,u,s,'essential','run','heroTitle',1,1000)<>'duplicate_call' then raise exception 'Duplicate admitted'; end if;
  if not public.settle_ai_provider_budget(c,50,'settled') then raise exception 'Settlement failed'; end if;
  if public.settle_ai_provider_budget(c,50,'settled') then raise exception 'Repeated settlement changed ledger'; end if;
  if (select charged_micros from public.ai_cost_reservations where call_id=c)<>50 then raise exception 'Actual spend mismatch'; end if;
  update public.ai_cost_policy set heavy_enabled=false;
  if public.reserve_ai_provider_budget(gen_random_uuid(),gen_random_uuid(),u,s,'growth','run','siteRevision',1,1000)<>'heavy_ai_paused' then raise exception 'Heavy breaker bypass'; end if;
  if public.reserve_ai_provider_budget(gen_random_uuid(),gen_random_uuid(),u,s,'essential','run','heroTitle',1,1000)<>'ok' then raise exception 'Heavy pause blocked light'; end if;
  update public.ai_cost_policy set global_monthly_micros=0;
  if public.reserve_ai_provider_budget(gen_random_uuid(),gen_random_uuid(),u,s,'essential','run','heroTitle',1,1000)<>'global_monthly_budget_limit' then raise exception 'Global budget bypass'; end if;
  update public.ai_cost_policy set global_monthly_micros=100000000;
  if public.reserve_ai_provider_budget(gen_random_uuid(),gen_random_uuid(),u,s,'essential','run','heroTitle',1,30001)<>'operation_budget_limit' then raise exception 'Operation cap bypass'; end if;
  if public.reserve_ai_provider_budget(gen_random_uuid(),gen_random_uuid(),u,s,'essential','launch','heroTitle',1,1000)<>'launch_reservation_required' then raise exception 'Missing launch accepted'; end if;
  -- Uncertain provider outcomes continue consuming the conservative ceiling.
  c:=gen_random_uuid();
  if public.reserve_ai_provider_budget(c,gen_random_uuid(),u,s,'essential','run','heroTitle',1,1000)<>'ok' then raise exception 'Uncertain fixture failed'; end if;
  perform public.settle_ai_provider_budget(c,null,'uncertain');
  if (select charged_micros from public.ai_cost_reservations where call_id=c)<>1000 then raise exception 'Uncertain spend erased'; end if;
end $$;
rollback;
