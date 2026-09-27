-- Make AI quota consumption derive its limits from the authenticated user's plan.
alter table public.ai_usage_events enable row level security;
create policy "users read own ai usage" on public.ai_usage_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own ai usage" on public.ai_usage_events for insert to authenticated with check ((select auth.uid()) = user_id);

create or replace function public.consume_my_ai_generation()
returns text language plpgsql security invoker set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_now timestamptz := now(); v_minute integer; v_daily integer; v_monthly integer;
begin
  if v_user_id is null then return 'unauthorized'; end if;
  select e.ai_minute_limit,e.ai_daily_limit,e.ai_monthly_limit into v_minute,v_daily,v_monthly from public.get_my_entitlements() e limit 1;
  if v_minute is null then return 'unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
  if (select count(*) from public.ai_usage_events where user_id=v_user_id and created_at >= v_now-interval '1 minute') >= v_minute then return 'minute_limit'; end if;
  if (select count(*) from public.ai_usage_events where user_id=v_user_id and created_at >= date_trunc('day',v_now)) >= v_daily then return 'daily_limit'; end if;
  if (select count(*) from public.ai_usage_events where user_id=v_user_id and created_at >= date_trunc('month',v_now)) >= v_monthly then return 'monthly_limit'; end if;
  insert into public.ai_usage_events(user_id,created_at) values(v_user_id,v_now); return 'ok';
end $$;
revoke all on function public.consume_my_ai_generation() from public, anon;
grant execute on function public.consume_my_ai_generation() to authenticated, service_role;
revoke execute on function public.consume_ai_generation(uuid,integer,integer,integer) from authenticated, anon, public;
