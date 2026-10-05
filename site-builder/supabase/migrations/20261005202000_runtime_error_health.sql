create table if not exists public.runtime_error_events (
  id bigint generated always as identity primary key,
  site_id uuid references public.sites(id) on delete cascade,
  route_path text not null check (char_length(route_path) between 1 and 200),
  route_type text not null check (route_type in ('render','route','action','proxy','unknown')),
  error_code text not null check (char_length(error_code) between 1 and 100),
  created_at timestamptz not null default now()
);

create index if not exists runtime_error_events_site_created_idx
  on public.runtime_error_events(site_id,created_at desc);

create index if not exists runtime_error_events_created_idx
  on public.runtime_error_events(created_at desc);

alter table public.runtime_error_events enable row level security;
revoke all on table public.runtime_error_events from public,anon,authenticated;
grant select,insert,delete on table public.runtime_error_events to service_role;

comment on table public.runtime_error_events is
  'Privacy-minimized ELTARA server error telemetry. Stores route pattern, normalized code, site scope and timestamp only; never raw messages, request bodies, query strings or stack traces.';

create extension if not exists pg_cron;

select cron.schedule(
  'eltara-runtime-errors-prune',
  '41 2 * * *',
  $$delete from public.runtime_error_events where created_at < now() - interval '30 days'$$
)
where not exists (
  select 1 from cron.job where jobname='eltara-runtime-errors-prune'
);
