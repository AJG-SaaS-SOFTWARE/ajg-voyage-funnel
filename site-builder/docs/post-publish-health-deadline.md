# Post-publication health GET deadline — 20 October 2026

## Change
Bound only the authenticated diagnostic GET and JSON-body read to 30 seconds.
The same per-read AbortController signal covers fetch and body consumption.
A Promise.race also settles the UI if a transport/body ignores abort; its late
success or rejection cannot commit display evidence. The existing request-version
guard still prevents an older timeout from overwriting a newer read. Clear the
timer on every settled path; each concurrent read owns its timer/controller.
No automatic retry, repair, publication replay, or change to the confirmed
publication outcome. The existing FR/EN unavailable state and Health Center link
provide the next step without claiming a site outage.

The deadline starts after site/token validation, not before getSession. It is
a browser event-loop timer, not a wall-clock SLA while a tab is suspended or the
main thread is blocked. It does not cancel server-side work or prove that the
site is unhealthy. No abort-on-unmount, active-site lifecycle invalidation,
cross-tab lock or session-preflight deadline is claimed. Supabase session access,
server ownership and permissions are unchanged.

## Verification
Nineteen tests extract/transpile the real TSX handler and actual diagnosis
validator. Controlled timers and native Node AbortController exercise FR/EN,
unchanged GET/bearer/locale contract, pending headers and pending JSON, abort-ignoring
late success/failure, actual signal-aware cancellation, independent deadlines,
old-timeout/latest-read races, fast failures, missing inputs and explicit recovery.
No source-text-only behavioral substitute and no real network outage is induced.

Local execution/Node/browser remains unavailable. A preliminary in-memory
diagnostic stripped only the handler/validator TypeScript syntax, used a synthetic
AbortController port and controlled timers: baseline b62e859b9517592acfbb5a504cec68bf6c114bdb
fails 18/19, patched passes 19/19. This is not npm test, native AbortController,
React rendering, TypeScript checking or browser evidence. Remote exact-head CI
must pass tests/types/lint/build, followed by source review and full merged CI,
before publication through the existing guarded pipeline. Record those results
and actual release evidence in the PR.

Browser/API cancellation reference: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
(consulted 20 October 2026). No dependency changes.

## Revalidated baseline and blockers
Builder main/release b62e859b9517592acfbb5a504cec68bf6c114bdb (#558), exact PR/main
CI39475963685/39476357475, release39476747801, visual39477338937 and latest
uptime39481469096 SUCCESS. Vercel dpl_2V8AFopnU5CULhD1yTFYAQv95mYg READY,
project prj_RUtVL1fXzOqY8dHetb6U2dp07Ygn, team team_T1xBMzY6HJCAkUStrmkUgj60,
production aliases attached. Cockpit main8fb3fb9c594c1eaf93d598785a86594f4458f6a1,
CI39145718566/SQL39145718568 SUCCESS. Both complete Git trees have no AGENTS.md;
current open PRs checked and preserved; no overlapping active health-read PR.

Public login and private intake cannot be retrieved by the authorized web reader
in this pass; this is a tool access failure, not evidence of any HTTP status.
No ordinary invited recipe identity with an explicitly authorized receiving
mailbox is established. Therefore ordinary email delivery -> browser session ->
sandbox Checkout -> server rights -> publication remains unproven. Do not reuse
an existing customer/admin identity, bypass auth or treat example.invalid rights
fixtures/provider sandbox as this proof.

Historical #525(req_5cbfea80)/#526(req_1b09b202) re-read open; canonical private
provenance is not established. No closure, reset, recreation, guessed test
attribution or permission retry. No repair/reconciliation redelivery of #530-#558.
Sales closed, no email/live payment/paid AI, no Auth/RLS/secret/permission/schema,
customer/history, domain/DNS, price/offer/legal changes.

## Next
Inspect session-preflight waiting separately before deciding a bounded logical
read; do not modify Auth configuration. Obtain legitimate ordinary-mailbox and
private-registry access before expanding those proofs. Preserve recurrence and
concurrent work. No claim about future triggers.
