alter table public.ai_usage_events
  add column if not exists site_id uuid references public.sites(id) on delete set null,
  add column if not exists request_id uuid;

create unique index if not exists ai_usage_events_request_id_uidx
  on public.ai_usage_events(request_id)
  where request_id is not null;

create or replace function private.reserve_my_site_ai_generation_internal(
  p_site_id uuid,
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_user_id uuid:=auth.uid();
  v_now timestamptz:=now();
  v_minute integer;
  v_daily integer;
  v_monthly integer;
begin
  if v_user_id is null then return 'unauthorized'; end if;
  if p_request_id is null then return 'invalid_request'; end if;

  if exists(
    select 1
    from public.ai_usage_events
    where user_id=v_user_id and request_id=p_request_id
  ) then
    return 'ok';
  end if;

  if not exists(
    select 1
    from public.get_my_site_capabilities(p_site_id) c
    where c.can_generate_ai
  ) then
    return 'unavailable';
  end if;

  select e.ai_minute_limit,e.ai_daily_limit,e.ai_monthly_limit
    into v_minute,v_daily,v_monthly
  from public.get_my_site_entitlements(p_site_id) e
  limit 1;

  if v_minute is null or v_minute<1 or v_daily<1 or v_monthly<1 then
    return 'unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));

  if (
    select count(*)
    from public.ai_usage_events
    where user_id=v_user_id and created_at>=v_now-interval '1 minute'
  )>=v_minute then return 'minute_limit'; end if;

  if (
    select count(*)
    from public.ai_usage_events
    where user_id=v_user_id and created_at>=date_trunc('day',v_now)
  )>=v_daily then return 'daily_limit'; end if;

  if (
    select count(*)
    from public.ai_usage_events
    where user_id=v_user_id and created_at>=date_trunc('month',v_now)
  )>=v_monthly then return 'monthly_limit'; end if;

  insert into public.ai_usage_events(user_id,site_id,request_id,created_at)
  values(v_user_id,p_site_id,p_request_id,v_now);

  return 'ok';
exception
  when unique_violation then
    return 'ok';
end
$$;

revoke all on function private.reserve_my_site_ai_generation_internal(uuid,uuid)
  from public,anon,authenticated;
grant execute on function private.reserve_my_site_ai_generation_internal(uuid,uuid)
  to authenticated,service_role;

create or replace function public.reserve_my_site_ai_generation(
  p_site_id uuid,
  p_request_id uuid
)
returns text
language sql
security invoker
set search_path='pg_catalog','private','pg_temp'
as $$
  select private.reserve_my_site_ai_generation_internal(p_site_id,p_request_id)
$$;

revoke all on function public.reserve_my_site_ai_generation(uuid,uuid)
  from public,anon;
grant execute on function public.reserve_my_site_ai_generation(uuid,uuid)
  to authenticated,service_role;

create or replace function private.release_my_site_ai_generation_internal(
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_user_id uuid:=auth.uid();
  v_deleted integer:=0;
begin
  if v_user_id is null or p_request_id is null then return false; end if;

  delete from public.ai_usage_events
  where user_id=v_user_id
    and request_id=p_request_id;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end
$$;

revoke all on function private.release_my_site_ai_generation_internal(uuid)
  from public,anon,authenticated;
grant execute on function private.release_my_site_ai_generation_internal(uuid)
  to authenticated,service_role;

create or replace function public.release_my_site_ai_generation(
  p_request_id uuid
)
returns boolean
language sql
security invoker
set search_path='pg_catalog','private','pg_temp'
as $$
  select private.release_my_site_ai_generation_internal(p_request_id)
$$;

revoke all on function public.release_my_site_ai_generation(uuid)
  from public,anon;
grant execute on function public.release_my_site_ai_generation(uuid)
  to authenticated,service_role;

grant usage on schema private to authenticated;
grant execute on function private.reserve_my_site_ai_generation_internal(uuid,uuid)
  to authenticated;
grant execute on function private.release_my_site_ai_generation_internal(uuid)
  to authenticated;

comment on column public.ai_usage_events.request_id is
  'Opaque request identifier used to release a reserved quota unit when a Premium generation fails before returning a usable proposal.';
comment on column public.ai_usage_events.site_id is
  'Optional site attribution for quota reservations; anti-abuse limits remain global per user.';
