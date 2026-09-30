-- Aggregate in PostgreSQL, not a capped PostgREST row page.
create function public.ai_finops_monthly_report(p_month date default current_date)
returns jsonb language sql stable security invoker
set search_path=pg_catalog,public,pg_temp as $$
with bounds as (
  select date_trunc('month',p_month::timestamp) at time zone 'UTC' lo,
    (date_trunc('month',p_month::timestamp)+interval '1 month') at time zone 'UTC' hi
), costs as (
  select request_id,user_id,site_id,plan_key,operation,pool,charged_micros cost,
    state<>'settled' uncertain,created_at
  from public.ai_cost_reservations,bounds where created_at>=lo and created_at<hi
  union all
  select request_id,user_id,site_id,plan_key,operation,
    case when access_source in ('ai_launch','growth_launch') then 'launch' else 'run' end,
    estimated_cost_usd_micros,not pricing_known,created_at
  from public.ai_provider_usage,bounds where request_id is null and created_at>=lo and created_at<hi
), dimensional as (
  select dimension,key,sum(cost)::bigint cost_micros,count(*) calls,count(*) filter(where uncertain) uncertain_calls
  from costs cross join lateral(values
    ('plan',plan_key),('user',coalesce(user_id::text,'deleted')),
    ('site',coalesce(site_id::text,'deleted')),('operation',operation),
    ('day',to_char(created_at at time zone 'UTC','YYYY-MM-DD'))
  ) dims(dimension,key) group by dimension,key
), requests as (
  select c.request_id,a.operation,a.state,sum(c.charged_micros) cost,bool_or(c.state<>'settled') uncertain
  from public.ai_cost_reservations c join public.ai_request_admissions a on a.request_id=c.request_id cross join bounds
  where a.created_at>=lo and a.created_at<hi
  group by c.request_id,a.operation,a.state
), request_stats as (
  select operation,count(*) attempts,count(*) filter(where state='completed' and not uncertain) measured_successes,
    avg(cost) filter(where state='completed' and not uncertain) mean_micros,
    percentile_disc(0.95) within group(order by cost) filter(where state='completed' and not uncertain) p95_micros,
    sum(cost) filter(where state<>'completed') failed_cost_micros
  from requests group by operation
), user_plan as (
  select plan_key,user_id,sum(cost) cost from costs where pool<>'launch' and user_id is not null group by plan_key,user_id
), plan_stats as (
  select plan_key,count(*) accounts_with_ai,avg(cost) mean_micros,
    percentile_disc(0.5) within group(order by cost) median_micros,
    percentile_disc(0.95) within group(order by cost) p95_micros
  from user_plan group by plan_key
), launch_costs as (
  -- BUILD purchases are measured cumulatively, including failed/retried pipeline calls.
  select r.launch_id,sum(r.charged_micros) cost,bool_or(r.state<>'settled') uncertain,
    max(l.operations_total) total,max(l.operations_used) used
  from public.ai_cost_reservations r join public.site_ai_launch_entitlements l on l.id=r.launch_id
  group by r.launch_id
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
  'requests',coalesce((select jsonb_agg(jsonb_build_object('operation',operation,'attempts',attempts,'measuredSuccesses',measured_successes,'meanMicros',mean_micros,'p95Micros',p95_micros,'failedCostMicros',coalesce(failed_cost_micros,0))) from request_stats),'[]'::jsonb),
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
