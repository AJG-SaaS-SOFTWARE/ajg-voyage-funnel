drop policy if exists "deny client access to ai provider usage"
  on public.ai_provider_usage;

create policy "deny client access to ai provider usage"
  on public.ai_provider_usage
  for all
  to anon, authenticated
  using (false)
  with check (false);
