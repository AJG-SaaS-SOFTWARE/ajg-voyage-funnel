create table if not exists public.site_daily_metrics (
  site_id uuid not null references public.sites(id) on delete cascade,
  metric_date date not null default ((now() at time zone 'utc')::date),
  page_key text not null,
  metric_key text not null,
  event_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (site_id, metric_date, page_key, metric_key),
  constraint site_daily_metrics_page_key_length check (char_length(page_key) between 1 and 120),
  constraint site_daily_metrics_metric_key_check check (
    metric_key in ('page_view', 'primary_cta_click', 'contact_submit')
  ),
  constraint site_daily_metrics_event_count_check check (event_count >= 0)
);

comment on table public.site_daily_metrics is
  'Privacy-minimized website audience aggregates. Daily counters only: no visitor identifier, IP address, user-agent, referrer or raw navigation event is stored.';

alter table public.site_daily_metrics enable row level security;

revoke all on table public.site_daily_metrics from anon;
revoke all on table public.site_daily_metrics from authenticated;
grant select on table public.site_daily_metrics to authenticated;

drop policy if exists site_daily_metrics_select_own on public.site_daily_metrics;
create policy site_daily_metrics_select_own
on public.site_daily_metrics
for select
to authenticated
using (
  exists (
    select 1
    from public.sites s
    where s.id = site_daily_metrics.site_id
      and s.owner_id = (select auth.uid())
  )
);

create or replace function public.increment_site_daily_metric(
  p_site_id uuid,
  p_page_key text,
  p_metric_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_page text;
begin
  if p_metric_key not in ('page_view', 'primary_cta_click', 'contact_submit') then
    return false;
  end if;

  normalized_page := left(coalesce(nullif(trim(p_page_key), ''), '/'), 120);

  if not exists (
    select 1
    from public.sites s
    where s.id = p_site_id
      and s.status = 'published'
      and coalesce(s.public_access_state, 'live') = 'live'
      and coalesce(s.privacy_state, 'active') = 'active'
  ) then
    return false;
  end if;

  insert into public.site_daily_metrics (
    site_id,
    metric_date,
    page_key,
    metric_key,
    event_count,
    updated_at
  )
  values (
    p_site_id,
    (now() at time zone 'utc')::date,
    normalized_page,
    p_metric_key,
    1,
    now()
  )
  on conflict (site_id, metric_date, page_key, metric_key)
  do update set
    event_count = public.site_daily_metrics.event_count + 1,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.increment_site_daily_metric(uuid, text, text) from public;
revoke all on function public.increment_site_daily_metric(uuid, text, text) from anon;
revoke all on function public.increment_site_daily_metric(uuid, text, text) from authenticated;
grant execute on function public.increment_site_daily_metric(uuid, text, text) to service_role;

create or replace function public.purge_expired_site_daily_metrics()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.site_daily_metrics
  where metric_date < ((now() at time zone 'utc')::date - interval '25 months');

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_site_daily_metrics() from public;
revoke all on function public.purge_expired_site_daily_metrics() from anon;
revoke all on function public.purge_expired_site_daily_metrics() from authenticated;
grant execute on function public.purge_expired_site_daily_metrics() to service_role;
