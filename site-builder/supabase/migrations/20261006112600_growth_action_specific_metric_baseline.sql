alter table public.site_growth_actions
  add column if not exists baseline_metric_key text,
  add column if not exists baseline_metric_value numeric(6,2),
  add column if not exists baseline_sample_size bigint,
  add column if not exists baseline_context text;

alter table public.site_growth_actions
  drop constraint if exists site_growth_actions_baseline_metric_key_check;

alter table public.site_growth_actions
  add constraint site_growth_actions_baseline_metric_key_check
  check (
    baseline_metric_key is null
    or baseline_metric_key in ('page_action_rate','form_completion_rate','source_concentration')
  );

alter table public.site_growth_actions
  drop constraint if exists site_growth_actions_baseline_sample_size_check;

alter table public.site_growth_actions
  add constraint site_growth_actions_baseline_sample_size_check
  check (baseline_sample_size is null or baseline_sample_size >= 0);

comment on column public.site_growth_actions.baseline_metric_key is
  'Specific KPI tracked for the Growth action.';
comment on column public.site_growth_actions.baseline_metric_value is
  'Baseline KPI value in percentage points.';
comment on column public.site_growth_actions.baseline_sample_size is
  'Observation volume supporting the baseline KPI.';
comment on column public.site_growth_actions.baseline_context is
  'Non-sensitive metric context such as page path or coarse source category.';
