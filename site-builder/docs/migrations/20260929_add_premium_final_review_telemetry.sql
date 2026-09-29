alter table public.ai_provider_usage
  drop constraint if exists ai_provider_usage_operation_check;

alter table public.ai_provider_usage
  add constraint ai_provider_usage_operation_check
  check (
    operation in (
      'premium_strategy',
      'premium_creation',
      'premium_review',
      'premium_refinement',
      'premium_final_review'
    )
  );
