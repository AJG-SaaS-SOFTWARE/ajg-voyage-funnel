create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.consume_ai_generation_internal(
 p_user_id uuid,p_minute_limit integer default 5,p_daily_limit integer default 50,p_monthly_limit integer default 200
) returns text language plpgsql security definer set search_path to 'pg_catalog','public','private','pg_temp' as $$
declare v_now timestamptz:=now();
begin
 if p_user_id is null or p_user_id<>auth.uid() then return 'unauthorized'; end if;
 if p_minute_limit<1 or p_daily_limit<1 or p_monthly_limit<1 then return 'invalid_limits'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 if (select count(*) from public.ai_usage_events where user_id=p_user_id and created_at>=v_now-interval '1 minute')>=least(p_minute_limit,5) then return 'minute_limit'; end if;
 if (select count(*) from public.ai_usage_events where user_id=p_user_id and created_at>=date_trunc('day',v_now))>=least(p_daily_limit,50) then return 'daily_limit'; end if;
 if (select count(*) from public.ai_usage_events where user_id=p_user_id and created_at>=date_trunc('month',v_now))>=least(p_monthly_limit,200) then return 'monthly_limit'; end if;
 insert into public.ai_usage_events(user_id,created_at) values(p_user_id,v_now); return 'ok';
end $$;
revoke all on function private.consume_ai_generation_internal(uuid,integer,integer,integer) from public,anon;
grant execute on function private.consume_ai_generation_internal(uuid,integer,integer,integer) to authenticated,service_role;
create or replace function public.consume_ai_generation(p_user_id uuid,p_minute_limit integer default 5,p_daily_limit integer default 50,p_monthly_limit integer default 200)
returns text language sql security invoker set search_path to 'pg_catalog','private','pg_temp' as $$
 select private.consume_ai_generation_internal(p_user_id,p_minute_limit,p_daily_limit,p_monthly_limit)
$$;
revoke all on function public.consume_ai_generation(uuid,integer,integer,integer) from public,anon;
grant execute on function public.consume_ai_generation(uuid,integer,integer,integer) to authenticated,service_role;

create or replace function private.submit_contact_message_internal(
 p_site_id uuid,p_sender_name text,p_sender_email text,p_subject text,p_message text,p_consent boolean,p_abuse_fingerprint text
) returns uuid language plpgsql security definer set search_path to 'pg_catalog','public','private','pg_temp' as $$
declare v_owner uuid;v_id uuid;
begin
 if p_consent is not true then raise exception 'consent_required' using errcode='22023'; end if;
 if char_length(trim(p_sender_name)) not between 1 and 100 or char_length(trim(p_sender_email)) not between 3 and 254
 or p_sender_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' or char_length(coalesce(p_subject,''))>160
 or char_length(trim(p_message)) not between 10 and 4000 or char_length(p_abuse_fingerprint) not between 32 and 128
 then raise exception 'invalid_contact_message' using errcode='22023'; end if;
 select owner_id into v_owner from public.sites where id=p_site_id and status='published';
 if v_owner is null then raise exception 'site_not_available' using errcode='22023'; end if;
 if (select count(*) from public.contact_messages where site_id=p_site_id and abuse_fingerprint=p_abuse_fingerprint and created_at>now()-interval '15 minutes')>=3
 then raise exception 'rate_limited' using errcode='P0001'; end if;
 insert into public.contact_messages(site_id,owner_id,sender_name,sender_email,subject,message,consent_at,abuse_fingerprint)
 values(p_site_id,v_owner,trim(p_sender_name),lower(trim(p_sender_email)),left(coalesce(p_subject,''),160),trim(p_message),now(),p_abuse_fingerprint)
 returning id into v_id;return v_id;
end $$;
revoke all on function private.submit_contact_message_internal(uuid,text,text,text,text,boolean,text) from public,authenticated;
grant execute on function private.submit_contact_message_internal(uuid,text,text,text,text,boolean,text) to anon,service_role;
create or replace function public.submit_contact_message(p_site_id uuid,p_sender_name text,p_sender_email text,p_subject text,p_message text,p_consent boolean,p_abuse_fingerprint text)
returns uuid language sql security invoker set search_path to 'pg_catalog','private','pg_temp' as $$
 select private.submit_contact_message_internal(p_site_id,p_sender_name,p_sender_email,p_subject,p_message,p_consent,p_abuse_fingerprint)
$$;
revoke all on function public.submit_contact_message(uuid,text,text,text,text,boolean,text) from public,authenticated;
grant execute on function public.submit_contact_message(uuid,text,text,text,text,boolean,text) to anon,service_role;


-- Active plan-aware AI allowance used by the application.
create or replace function private.consume_my_ai_generation_internal()
returns text language plpgsql security definer set search_path to 'pg_catalog','public','private','pg_temp' as $$
declare v_user_id uuid:=auth.uid();v_now timestamptz:=now();v_minute integer;v_daily integer;v_monthly integer;
begin
 if v_user_id is null then return 'unauthorized'; end if;
 select e.ai_minute_limit,e.ai_daily_limit,e.ai_monthly_limit into v_minute,v_daily,v_monthly from public.get_my_entitlements() e limit 1;
 if v_minute is null or v_minute<1 or v_daily<1 or v_monthly<1 then return 'unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
 if (select count(*) from public.ai_usage_events where user_id=v_user_id and created_at>=v_now-interval '1 minute')>=v_minute then return 'minute_limit'; end if;
 if (select count(*) from public.ai_usage_events where user_id=v_user_id and created_at>=date_trunc('day',v_now))>=v_daily then return 'daily_limit'; end if;
 if (select count(*) from public.ai_usage_events where user_id=v_user_id and created_at>=date_trunc('month',v_now))>=v_monthly then return 'monthly_limit'; end if;
 insert into public.ai_usage_events(user_id,created_at) values(v_user_id,v_now);return 'ok';
end $$;
revoke all on function private.consume_my_ai_generation_internal() from public,anon;
grant execute on function private.consume_my_ai_generation_internal() to authenticated,service_role;
create or replace function public.consume_my_ai_generation()
returns text language sql security invoker set search_path to 'pg_catalog','private','pg_temp' as $$
 select private.consume_my_ai_generation_internal()
$$;
revoke all on function public.consume_my_ai_generation() from public,anon;
grant execute on function public.consume_my_ai_generation() to authenticated,service_role;


-- Usage counters stay readable without granting clients direct access to the internal ledger.
create or replace function private.get_my_ai_usage_internal()
returns table(today bigint,month bigint) language sql security definer set search_path to 'pg_catalog','public','pg_temp' as $$
 select
  (select count(*) from public.ai_usage_events where user_id=auth.uid() and created_at>=date_trunc('day',now()))::bigint,
  (select count(*) from public.ai_usage_events where user_id=auth.uid() and created_at>=date_trunc('month',now()))::bigint
$$;
revoke all on function private.get_my_ai_usage_internal() from public,anon;
grant execute on function private.get_my_ai_usage_internal() to authenticated,service_role;
create or replace function public.get_my_ai_usage()
returns table(today bigint,month bigint) language sql security invoker set search_path to 'pg_catalog','private','pg_temp' as $$
 select * from private.get_my_ai_usage_internal()
$$;
revoke all on function public.get_my_ai_usage() from public,anon;
grant execute on function public.get_my_ai_usage() to authenticated,service_role;
