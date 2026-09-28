create table if not exists public.ai_provider_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  operation text not null check (
    operation in (
      'premium_strategy',
      'premium_creation',
      'premium_review',
      'premium_refinement'
    )
  ),
  model text not null check (char_length(model) between 1 and 100),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  reasoning_tokens integer not null default 0 check (reasoning_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_provider_usage_user_created_idx
  on public.ai_provider_usage(user_id, created_at desc);
create index if not exists ai_provider_usage_site_created_idx
  on public.ai_provider_usage(site_id, created_at desc);
create index if not exists ai_provider_usage_operation_created_idx
  on public.ai_provider_usage(operation, created_at desc);

alter table public.ai_provider_usage enable row level security;
revoke all on table public.ai_provider_usage from public, anon, authenticated;
grant select, insert on table public.ai_provider_usage to service_role;

comment on table public.ai_provider_usage is
  'Server-only AI provider usage telemetry. Stores model/token/timing metadata only; never prompts, responses, briefs or customer content.';
