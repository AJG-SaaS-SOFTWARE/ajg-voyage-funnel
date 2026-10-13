-- Full creation/redesign always consumes BUILD, including paid Growth accounts.
-- Beta remains temporary and bounded by the existing heavy-operation admission.
begin;

create or replace function private.reserve_my_site_launch_operation_internal(
  p_site_id uuid,
  p_request_id uuid,
  p_operation text
)
returns text
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_user_id uuid:=auth.uid();
  v_entitlement public.site_ai_launch_entitlements%rowtype;
  v_beta boolean:=false;
begin
  if v_user_id is null then return 'unauthorized'; end if;
  if p_request_id is null then return 'invalid_request'; end if;
  if p_operation not in ('site_create','site_revision') then return 'invalid_operation'; end if;

  if not exists(
    select 1 from public.sites s
    where s.id=p_site_id and s.owner_id=v_user_id
  ) then return 'unauthorized'; end if;

  if exists(
    select 1 from public.site_ai_launch_operations o
    where o.request_id=p_request_id and o.owner_id=v_user_id
      and o.site_id=p_site_id and o.operation=p_operation
  ) then return 'ok'; end if;

  if exists(select 1 from public.site_ai_launch_operations o where o.request_id=p_request_id)
    then return 'request_conflict'; end if;

  v_beta:=public.has_active_beta_access();

  if v_beta then return 'unmetered_beta'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_site_id::text,1));

  select l.*
    into v_entitlement
  from public.site_ai_launch_entitlements l
  where l.site_id=p_site_id
    and l.owner_id=v_user_id
    and l.status='active'
    and l.operations_used<l.operations_total
    and (l.expires_at is null or l.expires_at>now())
  order by l.granted_at asc,l.id asc
  limit 1
  for update;

  if v_entitlement.id is null then return 'launch_required'; end if;

  insert into public.site_ai_launch_operations(
    request_id,entitlement_id,site_id,owner_id,operation,status,updated_at
  ) values(
    p_request_id,v_entitlement.id,p_site_id,v_user_id,p_operation,'reserved',now()
  )
  on conflict (request_id) do nothing;

  if not found then
    if exists(select 1 from public.site_ai_launch_operations o
      where o.request_id=p_request_id and o.owner_id=v_user_id
        and o.site_id=p_site_id and o.operation=p_operation)
      then return 'ok'; end if;
    return 'request_conflict';
  end if;

  update public.site_ai_launch_entitlements
  set
    operations_used=operations_used+1,
    status=case when operations_used+1>=operations_total then 'consumed' else 'active' end,
    updated_at=now()
  where id=v_entitlement.id;

  return 'ok';
end
$$;

create or replace function public.get_my_site_ai_access(p_site_id uuid)
returns table(
  can_create_site boolean,
  can_revise_site boolean,
  access_source text,
  launch_operations_remaining integer
)
language sql
stable
security invoker
set search_path=''
as $$
  with owned as (
    select exists(
      select 1 from public.sites s
      where s.id=p_site_id and s.owner_id=(select auth.uid())
    ) ok
  ),
  entitlement as (
    select e.plan_key,e.subscription_status
    from public.get_my_site_entitlements(p_site_id) e
    limit 1
  ),
  launch as (
    select coalesce(sum(greatest(0,l.operations_total-l.operations_used)),0)::integer remaining
    from public.site_ai_launch_entitlements l
    where l.site_id=p_site_id
      and l.owner_id=(select auth.uid())
      and l.status='active'
      and (l.expires_at is null or l.expires_at > now())
  ),
  flags as (
    select
      (select ok from owned) owned,
      public.has_active_beta_access() beta,
      coalesce((select plan_key='growth' and subscription_status in ('active','trialing','past_due') from entitlement),false) growth,
      coalesce((select remaining from launch),0) launch_remaining
  )
  select
    owned and (beta or launch_remaining>0) as can_create_site,
    owned and (beta or launch_remaining>0) as can_revise_site,
    case
      when not owned then 'none'
      when beta then 'beta'
      when launch_remaining>0 and growth then 'growth_launch'
      when launch_remaining>0 then 'ai_launch'
      when growth then 'growth'
      else 'none'
    end as access_source,
    case when owned then launch_remaining else 0 end
  from flags
$$;


commit;

