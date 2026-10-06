drop policy if exists "no client access to analytics rate limits" on public.site_analytics_rate_limits;
create policy "no client access to analytics rate limits"
  on public.site_analytics_rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);
