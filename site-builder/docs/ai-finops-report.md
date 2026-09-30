# Monthly AI FinOps reporting

The service-only `ai_finops_monthly_report(date)` RPC had already been applied on 30 September in the preceding work. Its exact applied migration is recovered here without reapplying it.

`/admin/finops` shows UTC calendar-month totals by user, site, plan, operation and day. PostgreSQL aggregates all ledger rows before limiting displayed dimensional rankings to 50; PostgREST's row cap cannot truncate monetary totals. `/api/admin/ai-finops` verifies the current user and database admin role before creating a service client. Both successful and failed responses are private/no-store.

The ledger is authoritative for guarded calls; only legacy telemetry without a root request is added, avoiding double counting. Unknown supplier outcomes remain provisions. Request mean/P95 groups all internal calls of a complete admitted generation; unsuccessful and uncertain calls are excluded from successful-generation statistics but retained in total spend. BUILD entitlement costs are cumulative across months and retries, and remain provisional until the purchased capacity is consumed. RUN account statistics describe only accounts with AI activity, not all subscribers.

Global budget alerts identify the highest crossed threshold (50/75/90/100 percent). Current exposure includes unsettled prior-period reservations and reflects the exact admission window; it is explicitly separate from the selected historical month. Alerts are deterministic and make no AI calls. They are shown in the admin view; scheduled notification delivery is a subsequent block.

Limitations: provider prices are versioned USD estimates, not reconciled invoices. No implicit USD/EUR conversion or margin claim. Actual beta calls are still absent. Historical request-level statistics currently depend on admission records retained for 30 days; a subsequent migration must snapshot operation/outcome in the monetary ledger so cleanup or deletion cannot erase those statistics. Historical BUILD statistics include only launch entitlements still present. Account averages include provisions and exclude deleted users and zero-usage accounts.

Validation: executable route authorization/error tests, month validation and threshold tests; SQL fixtures covering over 1,000 calls, grouped generation mean/P95, uncertainty, failure cost, UTC month separation and anonymous/authenticated RPC denial, all rolled back. Production release stays on the existing controlled release branch.
