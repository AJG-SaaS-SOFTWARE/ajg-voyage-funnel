-- Bound expensive Growth/Beta full-site AI operations separately from standard AI.
alter table public.subscription_plans
  add column if not exists heavy_ai_monthly_limit integer not null default 0
  check (heavy_ai_monthly_limit between 0 and 100);

update public.subscription_plans set heavy_ai_monthly_limit=0 where key in ('free','essential');
update public.subscription_plans set heavy_ai_monthly_limit=12 where key='growth';

create table if not exists public.site_ai_heavy_usage (
  request_id uuid primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('site_create','site_revision')),
  created_at timestamptz not null default now()
);

create index if not exists site_ai_heavy_usage_owner_month_idx
  on public.site_ai_heavy_usage(owner_id,created_at desc);

alter table public.site_ai_heavy_usage enable row level security;
revoke all on table public.site_ai_heavy_usage from public,anon,authenticated;
grant select,insert,delete on table public.site_ai_heavy_usage to service_role;

create or replace function private.reserve_my_site_heavy_ai_internal(
  p_site_id uuid,p_request_id uuid,p_operation text
)
returns text
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_user_id uuid:=auth.uid();
  v_plan_key text;
  v_status text;
  v_limit integer:=0;
  v_now timestamptz:=now();
begin
  if v_user_id is null then return 'unauthorized'; end if;
  if p_request_id is null then return 'invalid_request'; end if;
  if p_operation not in ('site_create','site_revision') then return 'invalid_operation'; end if;
  if not exists(select 1 from public.sites s where s.id=p_site_id and s.owner_id=v_user_id) then return 'unauthorized'; end if;
  if exists(select 1 from public.site_ai_heavy_usage h where h.request_id=p_request_id and h.owner_id=v_user_id) then return 'ok'; end if;

  if public.has_active_beta_access() then
    v_limit:=30;
  else
    select e.plan_key,e.subscription_status into v_plan_key,v_status
    from public.get_my_site_entitlements(p_site_id) e limit 1;
    if v_plan_key<>'growth' or v_status not in ('active','trialing') then return 'unavailable'; end if;
    select p.heavy_ai_monthly_limit into v_limit
    from public.subscription_plans p where p.key=v_plan_key and p.active=true;
  end if;

  if coalesce(v_limit,0)<1 then return 'unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,2));

  if (
    select count(*) from public.site_ai_heavy_usage h
    where h.owner_id=v_user_id and h.created_at>=date_trunc('month',v_now)
  )>=v_limit then return 'monthly_limit'; end if;

  insert into public.site_ai_heavy_usage(request_id,site_id,owner_id,operation,created_at)
  values(p_request_id,p_site_id,v_user_id,p_operation,v_now)
  on conflict (request_id) do nothing;
  return 'ok';
end
$$;

revoke all on function private.reserve_my_site_heavy_ai_internal(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.reserve_my_site_heavy_ai_internal(uuid,uuid,text) to authenticated,service_role;

create or replace function public.reserve_my_site_heavy_ai(p_site_id uuid,p_request_id uuid,p_operation text)
returns text language sql security invoker
set search_path='pg_catalog','private','pg_temp'
as $$select private.reserve_my_site_heavy_ai_internal(p_site_id,p_request_id,p_operation)$$;
revoke all on function public.reserve_my_site_heavy_ai(uuid,uuid,text) from public,anon;
grant execute on function public.reserve_my_site_heavy_ai(uuid,uuid,text) to authenticated,service_role;

create or replace function private.release_my_site_heavy_ai_internal(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare v_user_id uuid:=auth.uid();v_deleted integer:=0;
begin
  if v_user_id is null or p_request_id is null then return false; end if;
  delete from public.site_ai_heavy_usage where request_id=p_request_id and owner_id=v_user_id;
  get diagnostics v_deleted=row_count;
  return v_deleted>0;
end
$$;
revoke all on function private.release_my_site_heavy_ai_internal(uuid) from public,anon,authenticated;
grant execute on function private.release_my_site_heavy_ai_internal(uuid) to authenticated,service_role;

create or replace function public.release_my_site_heavy_ai(p_request_id uuid)
returns boolean language sql security invoker
set search_path='pg_catalog','private','pg_temp'
as $$select private.release_my_site_heavy_ai_internal(p_request_id)$$;
revoke all on function public.release_my_site_heavy_ai(uuid) from public,anon;
grant execute on function public.release_my_site_heavy_ai(uuid) to authenticated,service_role;

drop function if exists public.consume_my_site_launch_operation(uuid,uuid,text);
drop function if exists private.consume_my_site_launch_operation_internal(uuid,uuid,text);
