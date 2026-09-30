# AI cost admission — 30 September 2026

Every Responses API call from the writer passes through the same server gateway, including repairs and all five Architect stages. The authenticated route checks entitlements before calling this service-only gateway. No prompts or outputs are stored in the monetary ledger.

Admission reserves a conservative maximum using uncached UTF-8 input bytes (including schema/instructions), 4,096 framing tokens and the enforced output limit. Unknown prices, oversized context and Premium field-writing overrides fail closed. Provider tariffs remain versioned USD estimates, verified against https://developers.openai.com/api/docs/pricing. They are not invoice-reconciled costs and are not EUR amounts.

## Starting internal limits (USD, not customer promises)

- field: $0.03 per provider call; structured light/medium operation: $0.15; Architect: $0.75 per call;
- RUN: $1/month for Essentiel and $6/month for Growth, enforced across both site and user;
- daily: $0.25 for Essentiel, $2 for Growth/BUILD and $3 for Beta heavy usage;
- BUILD: $5 lifetime per launch entitlement, separate from RUN;
- Beta heavy pool: $10/month;
- account aggregate: $15/month across pools/sites;
- AJG global: $20/day and $100/month initially; service-only `ai_cost_policy` can change these internal beta ceilings;
- `ai_enabled` pauses all AI; `heavy_enabled` pauses Architect/revisions only. Published sites and manual editing continue operating.

These are hard ceilings, not the roadmap's median/P95 targets. Exchange conversion and margin alerts must use an explicit dated exchange rate and actual revenue; never assume USD=EUR.

## Atomicity and failure semantics

A short PostgreSQL transaction lock protects all admission and settlement totals. The lock is released before network execution. Pending and uncertain reservations stay counted, including prior periods. Duplicate `(request_id, sequence)` or call IDs are denied; provider calls never auto-retry.

Settlement uses returned actual token counts. Rejected 4xx without usage releases the monetary reservation. Unknown provider outcomes (network failures, 5xx, malformed success) retain the maximum provision until reconciliation. Provider cost exceeding the reserved ceiling automatically opens the global circuit breaker.

The customer quota, BUILD reservation and heavy-operation quota are released when no usable result is returned. Already incurred supplier spend is retained in the monetary ledger; refunding customer capacity must not erase spend. Existing quota release RPCs are idempotent. A failed quota release is conservative and needs reconciliation, not another provider call.

## Verification

- `tests/ai-provider-budget.test.mjs`: executable ceiling, admission, settlement, unknown outcome and writer refund tests with a mocked provider; no paid API calls;
- `tests/sql/ai-provider-budget.sql`: real service-role RPC and ACL tests, transaction rolled back;
- security advisors after migration: no new findings;
- typecheck, full tests, production build and smoke before release.

## Root-request admission

Service-only admission now serializes attempts per account. A semantic HMAC fingerprint ignores object-key order; no brief or prompt is stored. Identical requests within two minutes and overlapping active requests are denied before quota reservation. The optional `Idempotency-Key` binds user, site, operation and payload and is retained for 30 days; conflicting reuse is denied. Completed results are not replayed or persisted by this guard.

Cooldowns: two seconds for fields, ten for medium operations, two minutes for heavy operations. At most six admissions per minute and 150 per rolling day, including failed calls, supplement existing plan-specific quotas. A crashed worker's admission lease expires after five minutes, while monetary uncertainty remains counted. Root admission cleanup is opportunistic per account. Deleting a site no longer removes incurred spend or account admission counters; closing an account anonymizes spend references while preserving AJG's global budget.

## Next blocks

Automatic reconciliation of stale quota reservations; monthly reporting by user/site/plan/operation and request-level BUILD mean/P95; FX snapshots and margin alerts; diagnostic client explanations. Historical provider rows lack a root request and must not enter request-level P95 as if complete.
