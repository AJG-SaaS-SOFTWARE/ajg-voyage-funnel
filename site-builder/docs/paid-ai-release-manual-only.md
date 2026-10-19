# Paid AI release recipe: explicit manual execution

## Scheduling gap — 19 October 2026

The production workflow already requires `workflow_dispatch` and an explicitly
enabled `run_paid_ai_e2e` input for the full AI recipe; its default is false.
However, `vercel.json` separately scheduled `/api/cron/release-e2e` every hour at
minute 35. That automatic path does not use the workflow input. Provider blockers,
per-SHA success deduplication and retry limits are not authorization to spend.

Remove only that full-AI entry from Vercel's scheduled manifest. Structural FR/EN
validation at minute 25, support operations, beta operations, billing notifications
and media backups retain their existing schedules. The authenticated full recipe
and the existing manually opted-in release step remain available when a current
explicit budget authorization exists. No route/authentication/permission change,
new flag or secret is introduced. Customer AI capabilities are unchanged.

This prevents the configured Vercel schedule from automatically invoking this
paid test after new deployments. It does not prevent a separately authorized
manual API invocation, change product AI usage/quotas, prove lower measured spend,
or claim that previous attempts caused billable usage. No paid AI call was made
to reproduce the configuration gap.

## Verification and handoff

The existing schedule contract test is changed to require structural scheduling
and absence of the full-AI schedule. It fails against the old manifest and passes
after removal. Existing workflow tests continue to require manual opt-in/default
false. The post-promotion release now independently reads the live project via
the same authenticated GET `/v9/projects/{id}` already used by preflight. No
credential is extracted and no cron job is invoked. Up to six read-only attempts
allow configuration propagation; unconfirmed state fails validation without an
automatic rollback.

`scripts/verify-deployed-crons.mjs` verifies project/team identity, enabled cron
metadata, a valid scheduler-origin deployment ID and the exact path/schedule
multiset against the reviewed manifest. It rejects the paid recipe in either
manifest or live data, including its query/trailing-slash form. Missing, disabled,
extra, duplicate or changed definitions fail with fixed diagnostics and no raw
project metadata in logs. The origin ID is recorded without assuming unchanged
definitions receive a new ID on every release. This checks configured scheduling,
not successful natural invocation of every job or absence of future manual calls.

The response fields are documented in the official
[project API](https://vercel.com/docs/rest-api/projects/find-a-project-by-id-or-name).
Controlled metadata and CLI tests cover identity, enabled/disabled history,
missing/changed/duplicate jobs, retained paid jobs and confidential-content
rejection; workflow tests require the fresh read after promotion. Full exact-SHA
CI and the isolated release must pass before claiming the live check executed.
The recurring development task is not modified or disabled.

Baseline main/release/production `05f7602b39f765a53a291d7179e1d5b2ea973157`
(#538): controlled release 39306429332 succeeded with actual provider sandbox
lifecycle and durable journals 275 FR / 276 EN (structural support and cleanup
passed). Ordinary receiving email → browser authentication → Checkout is still
unproven, and #525/#526 remain open without their own resolution evidence.
No commercial opening, live payment, pricing, legal identity, schema/Auth/RLS,
existing customer data or secret/permission mutation is authorized here.
