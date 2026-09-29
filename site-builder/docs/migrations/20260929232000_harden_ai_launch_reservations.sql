alter table public.site_ai_launch_operations
  add column if not exists status text not null default 'committed';

alter table public.site_ai_launch_operations
  drop constraint if exists site_ai_launch_operations_status_check;

alter table public.site_ai_launch_operations
  add constraint site_ai_launch_operations_status_check
  check (status in ('reserved','committed'));

alter table public.site_ai_launch_operations
  add column if not exists updated_at timestamptz not null default now();

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
  v_growth boolean:=false;
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
  ) then return 'ok'; end if;

  v_beta:=public.has_active_beta_access();
  select coalesce(
    (
      select e.plan_key='growth'
        and e.subscription_status in ('active','trialing','past_due')
      from public.get_my_site_entitlements(p_site_id) e
      limit 1
    ),
    false
  ) into v_growth;

  if v_beta then return 'unmetered_beta'; end if;
  if p_operation='site_revision' and v_growth then return 'unmetered_growth'; end if;

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

  if not found then return 'ok'; end if;

  update public.site_ai_launch_entitlements
  set
    operations_used=operations_used+1,
    status=case when operations_used+1>=operations_total then 'consumed' else 'active' end,
    updated_at=now()
  where id=v_entitlement.id;

  return 'ok';
end
$$;

revoke all on function private.reserve_my_site_launch_operation_internal(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.reserve_my_site_launch_operation_internal(uuid,uuid,text) to authenticated,service_role;

create or replace function public.reserve_my_site_launch_operation(
  p_site_id uuid,
  p_request_id uuid,
  p_operation text
)
returns text
language sql
security invoker
set search_path='pg_catalog','private','pg_temp'
as $$
  select private.reserve_my_site_launch_operation_internal(
    p_site_id,p_request_id,p_operation
  )
$$;

revoke all on function public.reserve_my_site_launch_operation(uuid,uuid,text) from public,anon;
grant execute on function public.reserve_my_site_launch_operation(uuid,uuid,text) to authenticated,service_role;

create or replace function private.commit_my_site_launch_operation_internal(
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_user_id uuid:=auth.uid();
  v_updated integer:=0;
begin
  if v_user_id is null or p_request_id is null then return false; end if;

  update public.site_ai_launch_operations
  set status='committed',updated_at=now()
  where request_id=p_request_id
    and owner_id=v_user_id
    and status='reserved';

  get diagnostics v_updated=row_count;
  return v_updated>0;
end
$$;

revoke all on function private.commit_my_site_launch_operation_internal(uuid) from public,anon,authenticated;
grant execute on function private.commit_my_site_launch_operation_internal(uuid) to authenticated,service_role;

create or replace function public.commit_my_site_launch_operation(p_request_id uuid)
returns boolean
language sql
security invoker
set search_path='pg_catalog','private','pg_temp'
as $$
  select private.commit_my_site_launch_operation_internal(p_request_id)
$$;

revoke all on function public.commit_my_site_launch_operation(uuid) from public,anon;
grant execute on function public.commit_my_site_launch_operation(uuid) to authenticated,service_role;

create or replace function private.release_my_site_launch_operation_internal(
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_user_id uuid:=auth.uid();
  v_entitlement_id uuid;
  v_deleted integer:=0;
begin
  if v_user_id is null or p_request_id is null then return false; end if;

  select entitlement_id
    into v_entitlement_id
  from public.site_ai_launch_operations
  where request_id=p_request_id
    and owner_id=v_user_id
    and status='reserved'
  for update;

  if v_entitlement_id is null then return false; end if;

  delete from public.site_ai_launch_operations
  where request_id=p_request_id
    and owner_id=v_user_id
    and status='reserved';

  get diagnostics v_deleted=row_count;
  if v_deleted=0 then return false; end if;

  update public.site_ai_launch_entitlements
  set
    operations_used=greatest(0,operations_used-1),
    status=case when status='revoked' then 'revoked' else 'active' end,
    updated_at=now()
  where id=v_entitlement_id;

  return true;
end
$$;

revoke all on function private.release_my_site_launch_operation_internal(uuid) from public,anon,authenticated;
grant execute on function private.release_my_site_launch_operation_internal(uuid) to authenticated,service_role;

create or replace function public.release_my_site_launch_operation(p_request_id uuid)
returns boolean
language sql
security invoker
set search_path='pg_catalog','private','pg_temp'
as $$
  select private.release_my_site_launch_operation_internal(p_request_id)
$$;

revoke all on function public.release_my_site_launch_operation(uuid) from public,anon;
grant execute on function public.release_my_site_launch_operation(uuid) to authenticated,service_role;
