-- Cover the remaining foreign-key columns reported by the Supabase
-- performance advisor. No constraints, RLS rules, grants, or data change.

create index if not exists ai_request_admissions_site_id_idx
  on public.ai_request_admissions(site_id);

create index if not exists site_ai_heavy_usage_site_id_idx
  on public.site_ai_heavy_usage(site_id);

create index if not exists site_ai_launch_entitlements_owner_id_idx
  on public.site_ai_launch_entitlements(owner_id);

create index if not exists site_ai_launch_operations_entitlement_id_idx
  on public.site_ai_launch_operations(entitlement_id);

create index if not exists site_ai_launch_operations_owner_id_idx
  on public.site_ai_launch_operations(owner_id);

create index if not exists support_remediation_runs_ticket_id_idx
  on public.support_remediation_runs(ticket_id);
