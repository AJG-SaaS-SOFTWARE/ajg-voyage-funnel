-- Service-only monetary admission; no prompt or generated content persisted.
alter table public.ai_provider_usage
  add column if not exists request_id uuid,
  add column if not exists request_operation text;
create index if not exists ai_provider_usage_request_idx on public.ai_provider_usage(request_id);

create table public.ai_cost_policy (
  singleton boolean primary key default true check (singleton),
  ai_enabled boolean not null default true,
  heavy_enabled boolean not null default true,
  global_monthly_micros bigint not null default 100000000 check (global_monthly_micros >= 0),
  global_daily_micros bigint not null default 20000000 check (global_daily_micros >= 0)
);
insert into public.ai_cost_policy(singleton) values(true);

create table public.ai_cost_reservations (
  call_id uuid primary key,
  request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  launch_id uuid references public.site_ai_launch_entitlements(id) on delete set null,
  plan_key text not null,
  pool text not null check (pool in ('run','launch','beta')),
  operation text not null,
  sequence integer not null check (sequence between 1 and 5),
  reserved_micros bigint not null check (reserved_micros > 0),
  charged_micros bigint not null check (charged_micros >= 0),
  state text not null default 'reserved' check (state in ('reserved','settled','uncertain')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique(request_id,sequence)
);
create index ai_cost_reservations_user_time_idx on public.ai_cost_reservations(user_id,created_at);
create index ai_cost_reservations_site_time_idx on public.ai_cost_reservations(site_id,created_at);
create index ai_cost_reservations_launch_idx on public.ai_cost_reservations(launch_id);
create index ai_cost_reservations_time_idx on public.ai_cost_reservations(created_at);

alter table public.ai_cost_policy enable row level security;
alter table public.ai_cost_reservations enable row level security;
revoke all on public.ai_cost_policy,public.ai_cost_reservations from public,anon,authenticated;
grant all on public.ai_cost_policy,public.ai_cost_reservations to service_role;
-- Explicit service policies document the access model; clients have no grants.
create policy ai_cost_policy_service on public.ai_cost_policy to service_role using (true) with check (true);
create policy ai_cost_reservations_service on public.ai_cost_reservations to service_role using (true) with check (true);

create function public.reserve_ai_provider_budget(
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
    or p_sequence is null or p_sequence not between 1 and 5
    or p_reserved_micros is null or p_reserved_micros <= 0
    then return 'invalid_budget_request'; end if;
  if not exists(select 1 from public.sites where id=p_site_id and owner_id=p_user_id) then return 'forbidden'; end if;
  -- Short atomic admission lock spans all accounts, preventing concurrent global overspend.
  -- It is released before HTTP; provider latency never holds this lock.
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
  -- Include unresolved prior-period reservations conservatively until reconciliation.
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

create function public.settle_ai_provider_budget(p_call_id uuid,p_cost_micros bigint,p_state text)
returns boolean language plpgsql security invoker
set search_path=pg_catalog,public,pg_temp as $$
declare v_reserved bigint;
begin
  if p_state is null or p_state not in ('settled','uncertain') or (p_state='settled' and (p_cost_micros is null or p_cost_micros<0)) then return false; end if;
  perform pg_advisory_xact_lock(71926260929);
  select reserved_micros into v_reserved from public.ai_cost_reservations where call_id=p_call_id and state='reserved' for update;
  if not found then return false; end if;
  update public.ai_cost_reservations set state=p_state,charged_micros=case when p_state='uncertain' then reserved_micros else p_cost_micros end,settled_at=now() where call_id=p_call_id;
  -- A violated provider ceiling indicates a pricing/token framing drift; fail closed.
  if p_cost_micros>v_reserved then update public.ai_cost_policy set ai_enabled=false where singleton; end if;
  return true;
end $$;
revoke all on function public.reserve_ai_provider_budget(uuid,uuid,uuid,uuid,text,text,text,integer,bigint) from public,anon,authenticated;
revoke all on function public.settle_ai_provider_budget(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_provider_budget(uuid,uuid,uuid,uuid,text,text,text,integer,bigint) to service_role;
grant execute on function public.settle_ai_provider_budget(uuid,bigint,text) to service_role;
