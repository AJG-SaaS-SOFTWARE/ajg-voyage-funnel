create table if not exists public.site_analytics_daily (
  site_id uuid not null references public.sites(id) on delete cascade,
  day date not null default current_date,
  event_name text not null check (event_name in ('page_view','cta_click','form_start','form_submit')),
  page_path text not null default '/',
  source text not null default 'direct' check (source in ('direct','internal','search','social','referral','other')),
  event_label text not null default '',
  event_count bigint not null default 0 check (event_count >= 0),
  primary key (site_id, day, event_name, page_path, source, event_label)
);

create index if not exists site_analytics_daily_site_day_idx
  on public.site_analytics_daily(site_id, day desc);

alter table public.site_analytics_daily enable row level security;

revoke all on table public.site_analytics_daily from anon;
revoke all on table public.site_analytics_daily from authenticated;
grant select on table public.site_analytics_daily to authenticated;
grant select, insert, update, delete on table public.site_analytics_daily to service_role;

drop policy if exists "owners read site analytics" on public.site_analytics_daily;
create policy "owners read site analytics"
  on public.site_analytics_daily
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sites s
      where s.id = site_analytics_daily.site_id
        and s.owner_id = (select auth.uid())
    )
  );

create table if not exists public.site_analytics_rate_limits (
  site_id uuid not null references public.sites(id) on delete cascade,
  fingerprint text not null,
  minute_bucket timestamptz not null,
  event_name text not null,
  page_path text not null,
  event_count integer not null default 1 check (event_count > 0),
  created_at timestamptz not null default now(),
  primary key (site_id, fingerprint, minute_bucket, event_name, page_path)
);

create index if not exists site_analytics_rate_limits_created_idx
  on public.site_analytics_rate_limits(created_at);

alter table public.site_analytics_rate_limits enable row level security;

revoke all on table public.site_analytics_rate_limits from anon;
revoke all on table public.site_analytics_rate_limits from authenticated;
grant select, insert, update, delete on table public.site_analytics_rate_limits to service_role;

create or replace function public.record_site_analytics_event(
  p_site_id uuid,
  p_event_name text,
  p_page_path text,
  p_source text,
  p_event_label text,
  p_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event text := lower(coalesce(p_event_name, ''));
  v_path text := left(coalesce(nullif(p_page_path, ''), '/'), 160);
  v_source text := lower(coalesce(p_source, 'direct'));
  v_label text := lower(left(coalesce(p_event_label, ''), 40));
  v_minute timestamptz := date_trunc('minute', now());
  v_count integer;
  v_limit integer;
begin
  if v_event not in ('page_view','cta_click','form_start','form_submit') then
    return false;
  end if;

  if v_path !~ '^/[A-Za-z0-9/_%.-]*$' then
    v_path := '/';
  end if;

  if v_source not in ('direct','internal','search','social','referral','other') then
    v_source := 'other';
  end if;

  if v_label !~ '^[a-z0-9_-]{0,40}$' then
    v_label := '';
  end if;

  if length(coalesce(p_fingerprint, '')) < 32 then
    return false;
  end if;

  if not exists (
    select 1
    from public.sites s
    where s.id = p_site_id
      and s.status = 'published'
      and s.public_access_state = 'live'
      and s.privacy_state = 'active'
  ) then
    return false;
  end if;

  insert into public.site_analytics_rate_limits(
    site_id, fingerprint, minute_bucket, event_name, page_path, event_count
  )
  values (
    p_site_id, left(p_fingerprint, 128), v_minute, v_event, v_path, 1
  )
  on conflict (site_id, fingerprint, minute_bucket, event_name, page_path)
  do update set event_count = public.site_analytics_rate_limits.event_count + 1
  returning event_count into v_count;

  v_limit := case when v_event = 'page_view' then 30 else 15 end;
  if v_count > v_limit then
    return false;
  end if;

  insert into public.site_analytics_daily(
    site_id, day, event_name, page_path, source, event_label, event_count
  )
  values (
    p_site_id, current_date, v_event, v_path, v_source, v_label, 1
  )
  on conflict (site_id, day, event_name, page_path, source, event_label)
  do update set event_count = public.site_analytics_daily.event_count + 1;

  if random() < 0.01 then
    delete from public.site_analytics_rate_limits
    where created_at < now() - interval '2 days';
  end if;

  return true;
end;
$function$;

revoke all on function public.record_site_analytics_event(uuid,text,text,text,text,text) from public;
revoke all on function public.record_site_analytics_event(uuid,text,text,text,text,text) from anon;
revoke all on function public.record_site_analytics_event(uuid,text,text,text,text,text) from authenticated;
grant execute on function public.record_site_analytics_event(uuid,text,text,text,text,text) to service_role;
