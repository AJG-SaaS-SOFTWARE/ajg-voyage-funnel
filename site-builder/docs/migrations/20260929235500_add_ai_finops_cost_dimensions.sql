alter table public.ai_provider_usage
  add column if not exists estimated_cost_usd_micros bigint not null default 0
    check (estimated_cost_usd_micros >= 0),
  add column if not exists pricing_version text not null default 'unknown',
  add column if not exists pricing_known boolean not null default false,
  add column if not exists plan_key text not null default 'unknown',
  add column if not exists access_source text not null default 'unknown';

create index if not exists ai_provider_usage_site_created_idx
  on public.ai_provider_usage(site_id,created_at desc);

create index if not exists ai_provider_usage_plan_created_idx
  on public.ai_provider_usage(plan_key,created_at desc);
