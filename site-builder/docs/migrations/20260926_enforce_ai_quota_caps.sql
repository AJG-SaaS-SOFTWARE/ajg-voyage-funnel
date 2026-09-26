-- La fonction est exposée aux utilisateurs connectés : borner les paramètres côté base.
create or replace function public.consume_ai_generation(
  p_user_id uuid,
  p_minute_limit integer default 5,
  p_daily_limit integer default 50,
  p_monthly_limit integer default 200
) returns text language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_now timestamptz := now();
begin
  if p_user_id is null or p_user_id <> auth.uid() then return 'unauthorized'; end if;
  if p_minute_limit < 1 or p_daily_limit < 1 or p_monthly_limit < 1 then return 'invalid_limits'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if (select count(*) from public.ai_usage_events where user_id=p_user_id and created_at >= v_now - interval '1 minute') >= least(p_minute_limit,5) then return 'minute_limit'; end if;
  if (select count(*) from public.ai_usage_events where user_id=p_user_id and created_at >= date_trunc('day', v_now)) >= least(p_daily_limit,50) then return 'daily_limit'; end if;
  if (select count(*) from public.ai_usage_events where user_id=p_user_id and created_at >= date_trunc('month', v_now)) >= least(p_monthly_limit,200) then return 'monthly_limit'; end if;
  insert into public.ai_usage_events(user_id,created_at) values (p_user_id,v_now);
  return 'ok';
end; $$;
