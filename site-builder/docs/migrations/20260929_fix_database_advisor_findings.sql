-- AJG Site Builder — database advisor follow-up
-- Safe production hardening identified during the 2026-09-29 account/infrastructure audit.

-- This policy is redundant with "owners or admins update domains", which already
-- grants the same administrator UPDATE capability while preserving owner access.
drop policy if exists "admins update domains" on public.domains;

-- Cover the site_id foreign key used by AI usage records.
create index if not exists ai_usage_events_site_id_idx
  on public.ai_usage_events(site_id);
