# Billing page opening: bounded client request

## Increment — 19 October 2026

The authenticated client helper used by My plan and Billing previously sent its
POST without a deadline. A stalled connection or response body could therefore
keep the page's existing in-flight lock and website selector disabled indefinitely.

Checkout (subscription and AI Creation) and Customer Portal now share a 60-second
`AbortSignal.timeout` for fetch and body consumption. A deadline check before
navigation also rejects a late successful body. Timeout errors use fixed FR/EN
uncertain-result wording, which does not claim that a payment was cancelled or
that nothing happened on the server. Existing page catch handlers release their
local lock and offer manual recovery. This helper never retries a mutation.

Authentication/session retrieval still happens before this network deadline and
is unchanged. The deadline uses browser active time, not a wall-clock SLA while a
tab is suspended. It neither cancels nor reconciles any session already created
at Stripe. It does not provide server idempotency, multi-tab exclusion or a
guarantee against duplicate purchases. Successful navigation keeps the existing
page guard. Server ownership, commercial gates, rights and webhook fulfillment
remain authoritative and unchanged.

## Verification

- Actual complete `billing-access.ts` is transpiled and exercised with controlled
  session, transport, deadline signal and navigation ports; no source-text-only
  substitute. Fifteen new assertions/tests fail before the change; all sixteen
  tests pass after it (one existing-behavior test already passed).
- Four public helper entry points in both locales retain method, route, bearer,
  locale, site and purchase payload. Tests cover expiry before headers, during
  JSON, a successful body arriving after expiry, and an actually pending fetch
  settling when its signal aborts. No navigation and exactly one POST on failure.
- Non-timeout transport failures, server refusals and malformed JSON preserve
  existing failure behavior without automatic retry. No provider request or
  real 60-second network outage is made/provoked by these synthetic tests.
- Full suite, types, lint, build and HTTP release smoke must pass locally and on
  the exact submitted SHA before merge. Production evidence is added to the PR
  after the existing isolated ELTARA release circuit completes.

## Boundaries and next action

Baseline main/production: `905c4c5737be0a70794c85cf01eafb0953aeff1c` (#535),
all 552 remote site-builder blobs matched the local baseline. No concurrent
active payment-flow PR was present. Unrelated draft PRs/worktrees are preserved.
No Auth/RLS, permission, secret, schema, price/offer, tax/legal identity or existing
customer data changes; no live payment, email or paid AI request.

Public browser login was checked without submission: private beta still requires
an invited email. No authorized receiving recipe mailbox/ordinary identity has
been established, so email delivery → browser session → Checkout → server rights
→ publication remains unproven. Preconfirmed example.invalid fixtures/injected
rights and provider sandbox lifecycle evidence are explicitly different proofs.
Sales remain closed. No inference of commercial/tax readiness is made.

Historical issues #525/#526 remain open without their own proven provenance or
resolution. Public natural RUN cycle at 2026-10-19T15:15:39Z still reported one
productSyncFailure and two stalled corrective work items, not a failure in this
client helper. No historical repair, reset, recreation or closure is performed.
Next: establish a legitimate invited recipe identity with a receiving mailbox;
retain historical uncertainty and work on independent authorized reliability.
