-- Internal quota ledger: clients must never query or mutate usage rows directly.
revoke all on table public.ai_usage_events from anon, authenticated;

-- The quota RPC is intentionally available only to signed-in users and service_role.
-- The function itself rejects p_user_id values different from auth.uid() and caps
-- caller-provided limits, so users cannot consume another account's quota or raise caps.
revoke execute on function public.consume_ai_generation(uuid, integer, integer, integer) from anon, public;
grant execute on function public.consume_ai_generation(uuid, integer, integer, integer) to authenticated, service_role;

comment on table public.ai_usage_events is
  'Internal AI quota ledger. Direct client access intentionally denied; writes occur through consume_ai_generation only.';
