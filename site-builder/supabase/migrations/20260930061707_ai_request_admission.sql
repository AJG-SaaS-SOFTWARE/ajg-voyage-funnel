create table public.ai_request_admissions (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  operation text not null,
  fingerprint text not null check (length(fingerprint)=64),
  key_hash text check (length(key_hash)=64),
  state text not null default 'started' check (state in ('started','completed','failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(user_id,key_hash)
);
create index ai_request_admissions_user_time_idx on public.ai_request_admissions(user_id,created_at);
create index ai_request_admissions_fingerprint_idx on public.ai_request_admissions(user_id,site_id,fingerprint,created_at);
alter table public.ai_request_admissions enable row level security;
revoke all on public.ai_request_admissions from public,anon,authenticated;
grant all on public.ai_request_admissions to service_role;
create policy ai_request_admissions_service on public.ai_request_admissions to service_role using(true) with check(true);

create function public.admit_ai_request(p_request_id uuid,p_user_id uuid,p_site_id uuid,p_operation text,p_fingerprint text,p_key_hash text)
returns text language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare
  v_existing public.ai_request_admissions%rowtype;
  v_cooldown integer:=case when p_operation in ('siteArchitect','siteRevision') then 120 when p_operation in ('guidedDraft','qualityReview','moduleDraft') then 10 else 2 end;
begin
  if p_request_id is null or p_user_id is null or p_site_id is null or p_operation is null
    or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
    or (p_key_hash is not null and p_key_hash !~ '^[a-f0-9]{64}$') then return 'invalid_request'; end if;
  if not exists(select 1 from public.sites where id=p_site_id and owner_id=p_user_id) then return 'forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,3));
  -- Opportunistic bounded-by-account cleanup; keys retained for 30 days.
  delete from public.ai_request_admissions where user_id=p_user_id and created_at<now()-interval '30 days';
  if p_key_hash is not null then
    select * into v_existing from public.ai_request_admissions where user_id=p_user_id and key_hash=p_key_hash;
    if found then
      if v_existing.fingerprint<>p_fingerprint or v_existing.site_id<>p_site_id or v_existing.operation<>p_operation then return 'idempotency_conflict'; end if;
      return 'duplicate_request';
    end if;
  end if;
  if exists(select 1 from public.ai_request_admissions where user_id=p_user_id and site_id=p_site_id and fingerprint=p_fingerprint and created_at>now()-interval '2 minutes') then return 'duplicate_request'; end if;
  -- At most one active generation per account, including across sites and operations.
  -- A crashed worker lease expires after five minutes; its possible spend stays reserved.
  if exists(select 1 from public.ai_request_admissions where user_id=p_user_id and state='started' and created_at>now()-interval '5 minutes') then return 'request_in_progress'; end if;
  if exists(select 1 from public.ai_request_admissions where user_id=p_user_id and operation=p_operation and created_at>now()-make_interval(secs=>v_cooldown)) then return 'operation_cooldown'; end if;
  -- Failed calls remain in admission counters, preventing refund/retry abuse.
  if (select count(*) from public.ai_request_admissions where user_id=p_user_id and created_at>now()-interval '1 minute')>=6 then return 'request_rate_limit'; end if;
  if (select count(*) from public.ai_request_admissions where user_id=p_user_id and created_at>now()-interval '1 day')>=150 then return 'request_daily_limit'; end if;
  insert into public.ai_request_admissions(request_id,user_id,site_id,operation,fingerprint,key_hash)
    values(p_request_id,p_user_id,p_site_id,p_operation,p_fingerprint,p_key_hash);
  return 'ok';
end $$;
create function public.finish_ai_request(p_request_id uuid,p_user_id uuid,p_state text)
returns boolean language sql security invoker set search_path=pg_catalog,public,pg_temp as $$
  with finished as (
    update public.ai_request_admissions set state=p_state,finished_at=now()
    where request_id=p_request_id and user_id=p_user_id and state='started' and p_state in ('completed','failed')
    returning request_id
  ) select exists(select 1 from finished)
$$;
revoke all on function public.admit_ai_request(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.finish_ai_request(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admit_ai_request(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.finish_ai_request(uuid,uuid,text) to service_role;
