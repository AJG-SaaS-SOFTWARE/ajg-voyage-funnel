create table public.ai_finops_alerts (
  id bigint generated always as identity primary key,
  scope text not null check(scope in ('global','account','site','launch')),
  subject_key text not null,
  user_id uuid references auth.users(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  kind text not null,
  period_start date not null,
  threshold integer not null check(threshold in (0,50,75,90,100)),
  level text not null check(level in ('info','warning','critical')),
  used_micros bigint not null check(used_micros>=0),
  cap_micros bigint not null check(cap_micros>=0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_scan uuid not null,
  resolved_at timestamptz,
  unique(scope,subject_key,kind,period_start)
);
create index ai_finops_alerts_active_idx on public.ai_finops_alerts(last_seen_at desc) where resolved_at is null;
create index ai_finops_alerts_user_idx on public.ai_finops_alerts(user_id);
create index ai_finops_alerts_site_idx on public.ai_finops_alerts(site_id);
alter table public.ai_finops_alerts enable row level security;
revoke all on public.ai_finops_alerts from public,anon,authenticated;
grant all on public.ai_finops_alerts to service_role;
grant usage,select on sequence public.ai_finops_alerts_id_seq to service_role;
create policy ai_finops_alerts_service on public.ai_finops_alerts to service_role using(true) with check(true);

create table public.ai_finops_monitor_state (
  singleton boolean primary key default true check(singleton),
  last_run_at timestamptz not null,
  last_scan uuid not null,
  active_alerts integer not null
);
alter table public.ai_finops_monitor_state enable row level security;
revoke all on public.ai_finops_monitor_state from public,anon,authenticated;
grant all on public.ai_finops_monitor_state to service_role;
create policy ai_finops_monitor_service on public.ai_finops_monitor_state to service_role using(true) with check(true);

create function public.run_ai_finops_monitor() returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare v_day date:=(now() at time zone 'UTC')::date;
  v_month date:=date_trunc('month',now() at time zone 'UTC')::date;
  v_scan uuid:=gen_random_uuid(); v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('ajg-finops-monitor',7));
  with active as (
    select * from public.ai_cost_reservations
    where state<>'settled' or coalesce(settled_at,created_at)>=v_month::timestamp at time zone 'UTC'
  ), account_latest as (
    select distinct on(user_id) user_id,plan_key,pool from active where user_id is not null order by user_id,created_at desc,call_id desc
  ), site_latest as (
    select distinct on(site_id) site_id,user_id,plan_key,pool from active where site_id is not null order by site_id,created_at desc,call_id desc
  ), budget_candidates as (
    select 'global'::text scope,'ajg'::text subject_key,null::uuid user_id,null::uuid site_id,'daily'::text kind,v_day period_start,
      coalesce((select sum(charged_micros) from active where state<>'settled' or coalesce(settled_at,created_at)>=v_day::timestamp at time zone 'UTC'),0)::bigint used,
      global_daily_micros cap from public.ai_cost_policy where singleton
    union all
    select 'global','ajg',null,null,'monthly',v_month,coalesce((select sum(charged_micros) from active),0)::bigint,global_monthly_micros from public.ai_cost_policy where singleton
    union all
    select 'account',user_id::text,user_id,null,'aggregate_monthly',v_month,sum(charged_micros)::bigint,15000000::bigint from active where user_id is not null group by user_id
    union all
    select 'account',a.user_id::text,a.user_id,null,'run_monthly',v_month,sum(c.charged_micros)::bigint,
      case when a.pool='beta' then 10000000 when a.plan_key='growth' then 6000000 else 1000000 end::bigint
      from account_latest a join active c on c.user_id=a.user_id where c.pool<>'launch' group by a.user_id,a.plan_key,a.pool
    union all
    select 'site',a.site_id::text,a.user_id,a.site_id,'run_monthly',v_month,sum(c.charged_micros)::bigint,
      case when a.pool='beta' then 10000000 when a.plan_key='growth' then 6000000 else 1000000 end::bigint
      from site_latest a join active c on c.site_id=a.site_id where c.pool<>'launch' group by a.site_id,a.user_id,a.plan_key,a.pool
    union all
    select 'launch',launch_reference::text,(array_agg(user_id) filter(where user_id is not null))[1],
      (array_agg(site_id) filter(where site_id is not null))[1],'launch_lifetime','1970-01-01'::date,sum(charged_micros)::bigint,5000000::bigint
      from public.ai_cost_reservations where launch_reference is not null and user_id is not null group by launch_reference
  ), thresholds as (
    select *,case when used>=cap then 100 when used*100>=cap*90 then 90 when used*100>=cap*75 then 75 when used*100>=cap*50 then 50 else 0 end threshold
    from budget_candidates
  ), signals as (
    select scope,subject_key,user_id,site_id,kind,period_start,threshold,
      case when threshold>=90 then 'critical' when threshold>=75 then 'warning' else 'info' end level,used,cap
    from thresholds where threshold>0
    union all
    select 'global','ajg',null,null,'stale_provision',v_day,0,'warning',sum(charged_micros)::bigint,0::bigint
      from public.ai_cost_reservations where state<>'settled' and created_at<now()-interval '5 minutes' having count(*)>0
    union all
    select 'global','ajg',null,null,'ai_paused',v_day,0,'critical',0,0 from public.ai_cost_policy where singleton and not ai_enabled
    union all
    select 'global','ajg',null,null,'heavy_paused',v_day,0,'warning',0,0 from public.ai_cost_policy where singleton and ai_enabled and not heavy_enabled
  )
  insert into public.ai_finops_alerts(scope,subject_key,user_id,site_id,kind,period_start,threshold,level,used_micros,cap_micros,last_scan)
  select scope,subject_key,user_id,site_id,kind,period_start,threshold,level,used,cap,v_scan from signals
  on conflict(scope,subject_key,kind,period_start) do update set
    threshold=excluded.threshold,level=excluded.level,used_micros=excluded.used_micros,cap_micros=excluded.cap_micros,
    last_seen_at=now(),last_scan=v_scan,resolved_at=null;

  update public.ai_finops_alerts set resolved_at=now() where resolved_at is null and last_scan<>v_scan;
  delete from public.ai_finops_alerts where resolved_at is not null and last_seen_at<now()-interval '90 days';
  select count(*) into v_count from public.ai_finops_alerts where resolved_at is null;
  insert into public.ai_finops_monitor_state(singleton,last_run_at,last_scan,active_alerts) values(true,now(),v_scan,v_count)
  on conflict(singleton) do update set last_run_at=excluded.last_run_at,last_scan=excluded.last_scan,active_alerts=excluded.active_alerts;
  return jsonb_build_object('ok',true,'runId',v_scan,'activeAlerts',v_count,'checkedAt',now());
end $$;

create function public.get_ai_finops_monitor_status() returns jsonb
language sql stable security invoker set search_path=pg_catalog,public,pg_temp as $$
select jsonb_build_object(
  'lastRunAt',(select last_run_at from public.ai_finops_monitor_state where singleton),
  'activeAlerts',(select count(*) from public.ai_finops_alerts where resolved_at is null),
  'items',coalesce((select jsonb_agg(to_jsonb(rows) order by last_seen_at desc,id desc) from (
    select id,scope,subject_key,kind,threshold,level,used_micros,cap_micros,last_seen_at
    from public.ai_finops_alerts where resolved_at is null order by last_seen_at desc,id desc limit 50
  ) rows),'[]'::jsonb)
)
$$;
revoke all on function public.run_ai_finops_monitor(),public.get_ai_finops_monitor_status() from public,anon,authenticated;
grant execute on function public.run_ai_finops_monitor(),public.get_ai_finops_monitor_status() to service_role;
