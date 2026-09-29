alter table public.ai_provider_usage
  add column if not exists estimated_cost_usd_micros bigint not null default 0
    check (estimated_cost_usd_micros >= 0),
  add column if not exists pricing_version text not null default 'unknown',
  add column if not exists pricing_known boolean not null default false,
  add column if not exists plan_key text not null default 'unknown',
  add column if not exists access_source text not null default 'unknown';

comment on column public.ai_provider_usage.estimated_cost_usd_micros is
  'Estimated provider cost in millionths of a US dollar, calculated at request time from the versioned pricing table.';
comment on column public.ai_provider_usage.pricing_version is
  'Version identifier for the pricing table used to estimate provider cost.';
comment on column public.ai_provider_usage.pricing_known is
  'False when the model had no matching versioned price and the estimated cost must not be treated as complete.';
comment on column public.ai_provider_usage.plan_key is
  'Commercial plan snapshot at request time.';
comment on column public.ai_provider_usage.access_source is
  'Source of AI entitlement at request time, such as standard, growth, beta or ai_launch.';

create index if not exists ai_provider_usage_cost_created_idx
  on public.ai_provider_usage(created_at desc, estimated_cost_usd_micros desc);

create index if not exists ai_provider_usage_plan_created_idx
  on public.ai_provider_usage(plan_key, created_at desc);
