-- Allow the bounded Premium Architect final-correction path to consume its full
-- worst-case provider sequence while keeping all monetary FinOps limits unchanged.
alter table public.ai_cost_reservations
  drop constraint if exists ai_cost_reservations_sequence_check;

alter table public.ai_cost_reservations
  add constraint ai_cost_reservations_sequence_check
  check (sequence between 1 and 7);

create or replace function public.reserve_ai_provider_budget(
  p_call_id uuid,p_request_id uuid,p_user_id uuid,p_site_id uuid,
  p_plan text,p_pool text,p_operation text,p_sequence integer,p_reserved_micros bigint
) returns text language plpgsql security invoker
set search_path=pg_catalog,public,pg_temp as $$
declare
  v_policy public.ai_cost_policy%rowtype;
  v_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  v_cap bigint;
  v_daily bigint;
  v_launch uuid;
  v_heavy boolean:=p_operation in ('siteArchitect','siteRevision');
begin
  if p_call_id is null or p_request_id is null or p_user_id is null or p_site_id is null
    or p_pool is null or p_pool not in ('run','launch','beta')
    or p_sequence is null or p_sequence not between 1 and 7
    or p_reserved_micros is null or p_reserved_micros <= 0
    then return 'invalid_budget_request'; end if;
  if not exists(select 1 from public.sites where id=p_site_id and owner_id=p_user_id) then return 'forbidden'; end if;
  perform pg_advisory_xact_lock(71926260929);
  select * into v_policy from public.ai_cost_policy where singleton;
  if not found or not v_policy.ai_enabled then return 'global_ai_paused'; end if;
  if v_heavy and not v_policy.heavy_enabled then return 'heavy_ai_paused'; end if;
  if exists(select 1 from public.ai_cost_reservations where call_id=p_call_id or (request_id=p_request_id and sequence=p_sequence)) then return 'duplicate_call'; end if;
  if p_reserved_micros > (case when v_heavy then 750000 when p_operation in ('guidedDraft','qualityReview','moduleDraft') then 150000 else 30000 end)
    then return 'operation_budget_limit'; end if;
  if p_pool='launch' then
    select entitlement_id into v_launch from public.site_ai_launch_operations
      where request_id=p_request_id and owner_id=p_user_id and site_id=p_site_id and status='reserved';
    if v_launch is null then return 'launch_reservation_required'; end if;
    if coalesce((select sum(charged_micros) from public.ai_cost_reservations where launch_id=v_launch),0)+p_reserved_micros > 5000000
      then return 'launch_budget_limit'; end if;
  end if;
  v_cap:=case when p_pool='beta' then 10000000 when p_plan='growth' then 6000000 else 1000000 end;
  v_daily:=case when p_pool='beta' then 3000000 when p_plan='growth' then 2000000 else 250000 end;
  if p_pool='launch' then v_daily:=2000000; end if;
  if coalesce((select sum(charged_micros) from public.ai_cost_reservations
      where state<>'settled' or coalesce(settled_at,created_at)>=v_month),0)+p_reserved_micros > v_policy.global_monthly_micros
    then return 'global_monthly_budget_limit'; end if;
  if coalesce((select sum(charged_micros) from public.ai_cost_reservations
      where state<>'settled' or coalesce(settled_at,created_at)>=v_day),0)+p_reserved_micros > v_policy.global_daily_micros
    then return 'global_daily_budget_limit'; end if;
  if coalesce((select sum(charged_micros) from public.ai_cost_reservations
      where user_id=p_user_id and (state<>'settled' or coalesce(settled_at,created_at)>=v_month)),0)+p_reserved_micros > 15000000
    then return 'account_budget_limit'; end if;
  if p_pool<>'launch' and (
    coalesce((select sum(charged_micros) from public.ai_cost_reservations
      where user_id=p_user_id and pool<>'launch' and (state<>'settled' or coalesce(settled_at,created_at)>=v_month)),0)+p_reserved_micros > v_cap
    or coalesce((select sum(charged_micros) from public.ai_cost_reservations
      where site_id=p_site_id and pool<>'launch' and (state<>'settled' or coalesce(settled_at,created_at)>=v_month)),0)+p_reserved_micros > v_cap
  ) then return 'monthly_budget_limit'; end if;
  if coalesce((select sum(charged_micros) from public.ai_cost_reservations
      where user_id=p_user_id and pool=p_pool and (state<>'settled' or coalesce(settled_at,created_at)>=v_day)),0)+p_reserved_micros > v_daily
    then return 'daily_budget_limit'; end if;
  insert into public.ai_cost_reservations(call_id,request_id,user_id,site_id,launch_id,plan_key,pool,operation,sequence,reserved_micros,charged_micros)
    values(p_call_id,p_request_id,p_user_id,p_site_id,v_launch,p_plan,p_pool,p_operation,p_sequence,p_reserved_micros,p_reserved_micros);
  return 'ok';
end $$;
