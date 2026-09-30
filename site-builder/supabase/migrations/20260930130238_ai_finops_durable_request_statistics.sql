-- Keep financial summaries independent from ephemeral anti-abuse records.
alter table public.ai_cost_reservations
  add column root_operation text,
  add column root_state text check (root_state in ('started','completed','failed')),
  add column root_started_at timestamptz,
  add column launch_reference uuid,
  add column launch_operations_total integer,
  add column launch_operations_used integer,
  add column requested_model text;

update public.ai_cost_reservations c set root_operation=a.operation,
  root_state=a.state,root_started_at=a.created_at
from public.ai_request_admissions a where a.request_id=c.request_id;
update public.ai_cost_reservations c set launch_reference=l.id,
  launch_operations_total=l.operations_total,launch_operations_used=l.operations_used
from public.site_ai_launch_entitlements l where l.id=c.launch_id;

create function public.snapshot_ai_cost_context() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
begin
  select operation,state,created_at into new.root_operation,new.root_state,new.root_started_at
    from public.ai_request_admissions where request_id=new.request_id;
  if new.launch_id is not null then
    select id,operations_total,operations_used into new.launch_reference,
      new.launch_operations_total,new.launch_operations_used
      from public.site_ai_launch_entitlements where id=new.launch_id;
  end if;
  return new;
end $$;
create trigger ai_cost_snapshot_context before insert on public.ai_cost_reservations
for each row execute function public.snapshot_ai_cost_context();

create function public.snapshot_ai_request_outcome() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
begin
  update public.ai_cost_reservations set root_state=new.state
    where request_id=new.request_id;
  return new;
end $$;
create trigger ai_cost_snapshot_outcome after update of state on public.ai_request_admissions
for each row when (old.state is distinct from new.state)
execute function public.snapshot_ai_request_outcome();

create function public.snapshot_ai_launch_usage() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
begin
  update public.ai_cost_reservations set launch_operations_total=new.operations_total,
    launch_operations_used=new.operations_used where launch_reference=new.id;
  return new;
end $$;
create trigger ai_cost_snapshot_launch after update of operations_used,operations_total on public.site_ai_launch_entitlements
for each row execute function public.snapshot_ai_launch_usage();

revoke all on function public.snapshot_ai_cost_context(),public.snapshot_ai_request_outcome(),public.snapshot_ai_launch_usage() from public,anon,authenticated;
grant execute on function public.snapshot_ai_cost_context(),public.snapshot_ai_request_outcome(),public.snapshot_ai_launch_usage() to service_role;
create index ai_cost_reservations_root_time_idx on public.ai_cost_reservations(root_started_at);
create index ai_cost_reservations_launch_reference_idx on public.ai_cost_reservations(launch_reference);

-- Atomic wrapper leaves the legacy admission signature available during release.
create function public.reserve_ai_provider_budget_with_model(
  p_call_id uuid,p_request_id uuid,p_user_id uuid,p_site_id uuid,
  p_plan text,p_pool text,p_operation text,p_sequence integer,p_reserved_micros bigint,p_model text
) returns text language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare v_result text;
begin
  if p_model is null or length(p_model)>100 or length(trim(p_model))=0 then return 'invalid_provider_model'; end if;
  v_result:=public.reserve_ai_provider_budget(p_call_id,p_request_id,p_user_id,p_site_id,p_plan,p_pool,p_operation,p_sequence,p_reserved_micros);
  if v_result='ok' then
    update public.ai_cost_reservations set requested_model=p_model where call_id=p_call_id;
  end if;
  return v_result;
end $$;
revoke all on function public.reserve_ai_provider_budget_with_model(uuid,uuid,uuid,uuid,text,text,text,integer,bigint,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_provider_budget_with_model(uuid,uuid,uuid,uuid,text,text,text,integer,bigint,text) to service_role;

-- Aggregate in PostgreSQL, not a capped PostgREST row page.
create or replace function public.ai_finops_monthly_report(p_month date default current_date)
returns jsonb language sql stable security invoker
set search_path=pg_catalog,public,pg_temp as $$
with bounds as (
  select date_trunc('month',p_month::timestamp) at time zone 'UTC' lo,
    (date_trunc('month',p_month::timestamp)+interval '1 month') at time zone 'UTC' hi
), costs as (
  select request_id,user_id,site_id,plan_key,operation,pool,charged_micros cost,
    state<>'settled' uncertain,created_at,coalesce(requested_model,'unrecorded') model
  from public.ai_cost_reservations,bounds where created_at>=lo and created_at<hi
  union all
  select request_id,user_id,site_id,plan_key,operation,
    case when access_source in ('ai_launch','growth_launch') then 'launch' else 'run' end,
    estimated_cost_usd_micros,not pricing_known,created_at,model
  from public.ai_provider_usage,bounds where request_id is null and created_at>=lo and created_at<hi
), dimensional as (
  select dimension,key,sum(cost)::bigint cost_micros,count(*) calls,count(*) filter(where uncertain) uncertain_calls
  from costs cross join lateral(values
    ('plan',plan_key),('user',coalesce(user_id::text,'deleted')),
    ('site',coalesce(site_id::text,'deleted')),('operation',operation),
    ('day',to_char(created_at at time zone 'UTC','YYYY-MM-DD')),('model',model)
  ) dims(dimension,key) group by dimension,key
), requests as (
  select c.request_id,coalesce(c.root_operation,c.operation) operation,c.root_state state,
    sum(c.charged_micros) cost,bool_or(c.state<>'settled') uncertain
  from public.ai_cost_reservations c cross join bounds
  where coalesce(c.root_started_at,c.created_at)>=lo and coalesce(c.root_started_at,c.created_at)<hi
  group by c.request_id,coalesce(c.root_operation,c.operation),c.root_state
), request_stats as (
  select operation,count(*) attempts,count(*) filter(where state='completed' and not uncertain) measured_successes,
    avg(cost) filter(where state='completed' and not uncertain) mean_micros,
    percentile_disc(0.95) within group(order by cost) filter(where state='completed' and not uncertain) p95_micros,
    sum(cost) filter(where state='failed') failed_cost_micros,
    count(*) filter(where state is null or state='started') unknown_outcomes
  from requests group by operation
), user_plan as (
  select plan_key,user_id,sum(cost) cost from costs where pool<>'launch' and user_id is not null group by plan_key,user_id
), plan_stats as (
  select plan_key,count(*) accounts_with_ai,avg(cost) mean_micros,
    percentile_disc(0.5) within group(order by cost) median_micros,
    percentile_disc(0.95) within group(order by cost) p95_micros
  from user_plan group by plan_key
), launch_costs as (
  -- Immutable reference and copied capacity survive entitlement deletion.
  select r.launch_reference,sum(r.charged_micros) cost,bool_or(r.state<>'settled') uncertain,
    max(r.launch_operations_total) total,max(r.launch_operations_used) used
  from public.ai_cost_reservations r where r.launch_reference is not null
  group by r.launch_reference
), ranked as (
  select *,row_number() over(partition by dimension order by cost_micros desc,key) rank from dimensional
), arrays as (
  select dimension,count(*) total_rows,
    coalesce(jsonb_agg(jsonb_build_object('key',key,'costMicros',cost_micros,'calls',calls,'uncertainCalls',uncertain_calls) order by cost_micros desc,key) filter(where rank<=50),'[]'::jsonb) rows
  from ranked group by dimension
)
select jsonb_build_object(
  'month',to_char((select lo from bounds) at time zone 'UTC','YYYY-MM'),
  'currency','USD',
  'totalCostMicros',coalesce((select sum(cost) from costs),0),
  'calls', (select count(*) from costs),
  'uncertainCalls',(select count(*) from costs where uncertain),
  'legacyUnlinkedCalls',(select count(*) from costs where request_id is null),
  'dimensions',coalesce((select jsonb_object_agg(dimension,jsonb_build_object('totalRows',total_rows,'rows',rows)) from arrays),'{}'::jsonb),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('operation',operation,'attempts',attempts,'measuredSuccesses',measured_successes,'meanMicros',mean_micros,'p95Micros',p95_micros,'failedCostMicros',coalesce(failed_cost_micros,0),'unknownOutcomes',unknown_outcomes)) from request_stats),'[]'::jsonb),
  'planAccounts',coalesce((select jsonb_agg(jsonb_build_object('plan',plan_key,'accountsWithAi',accounts_with_ai,'meanMicros',mean_micros,'medianMicros',median_micros,'p95Micros',p95_micros)) from plan_stats),'[]'::jsonb),
  'launchRights',jsonb_build_object(
    'measuredRights',(select count(*) from launch_costs where not uncertain),
    'meanToDateMicros',(select avg(cost) from launch_costs where not uncertain),
    'p95ToDateMicros',(select percentile_disc(0.95) within group(order by cost) from launch_costs where not uncertain),
    'completedRights',(select count(*) from launch_costs where not uncertain and used>=total),
    'meanCompletedMicros',(select avg(cost) from launch_costs where not uncertain and used>=total)
  ),
  'policy',(select to_jsonb(p) from public.ai_cost_policy p where singleton),
  'budgetExposure',jsonb_build_object(
    'monthMicros',coalesce((select sum(charged_micros) from public.ai_cost_reservations where state<>'settled' or coalesce(settled_at,created_at)>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),0),
    'dayMicros',coalesce((select sum(charged_micros) from public.ai_cost_reservations where state<>'settled' or coalesce(settled_at,created_at)>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),0)
  )
)
$$;
revoke all on function public.ai_finops_monthly_report(date) from public,anon,authenticated;
grant execute on function public.ai_finops_monthly_report(date) to service_role;
