# Customer repair receipt — 20 October 2026

The support-page repair action accepted a raw succeeded status without
correlating its site/action or checking verification/audit evidence. Session
rejections escaped the handler, concurrent clicks could issue multiple POSTs,
and a failed list refresh overwrote the repair confirmation. This increment
changes the client only; the existing repair engine, API, audit, central
reconciliation, rate limits and authorization are not changed or redeveloped.

A synchronous local guard now precedes session lookup. No offered site/action
means no session lookup or POST. A success requires HTTP200, exact site/action,
known result status, boolean changed and a correlated health diagnosis with
known overall/checks. Succeeded additionally requires changed/verified/audited
strictly true. No_change requires changed=false and is not reported as a failed
or applied repair. Failed can represent partial changes and never claims an
absence of effects or a successful correction.

Malformed JSON, unknown evidence, transport uncertainty and 5xx keep the repair
unconfirmed and show the existing read/refresh action. There is no automatic
POST retry. Missing/expired session shows sign-in; all exits release the guard.
A confirmed result survives a later GET failure or unavailable refresh. The old
repair offer is retired locally until a fresh diagnosis offers another safe
action. Arbitrary returned site/ticket fields are not merged into client state.
Messages remain French/English and claim neither central closure nor healthy
external DNS. A technical repair can succeed while another diagnosis remains
action/incident; this does not certify overall recovery.

Fourteen targeted tests execute the actual repair handler extracted by
TypeScript AST with isolated HTTP/session/state ports. Thirteen fail against
the exact previous main page188638e4; all fourteen pass after the fix. Cases
cover wrong/missing site/action, unverifiable evidence/strict flags, malformed
health/JSON, 202/5xx/network uncertainty, failed/no_change, duplicate clicks
before session await, session rejection/retry, absent session/401, confirmed
mutation plus failed/unavailable refresh, no offered action and normal success.
No real repair engine, browser, customer account, domain or database is used in
these tests. No cross-tab/remount lock or request deadline is claimed.

Baseline: main/release/production188638e48eaca2328693c3a26943aefc78d1dd79,
deployment dpl_2x3aCVWxWqELY7BSwAptv1Acdyk1 from #553. CI main39432571203,
release39432920560 and public captures39433469241 SUCCESS. Independent public
health2026-10-20T14:29:50.474Z confirms exact SHA/deployment and service/base OK.
Login200 still invitation-only; no authorized ordinary receiving identity/inbox
is established. Private cockpit intake401; #525/#526 remain uncertain and must
stay open without their own evidence. Cockpit8fb3fb9c594c1eaf93d598785a86594f4458f6a1
and four checks remain unchanged/green. Applicable instruction paths and PRs
were reread. Earlier worktrees and the concurrent builder-publication changes
are preserved; a separate worktree is used.

Validation: 1253 tests, TypeScript, lint (0 errors/21 existing warnings),
production build and full HTTP smoke pass locally. Exact remote CI must be
confirmed before publication. Final run/deployment/journal
IDs and limits belong in the PR checkpoint. Only the existing isolated
disposable/sandbox release circuit may run; no manual global RUN/repair. No
Auth/RLS/permission/secret/database/customer-data/history/dependency changes,
external DNS update, paid AI, live payment, purchase, message to a third party,
new infrastructure, price/offer/legal identity change or sales opening.

Next: do not redo #553 or central reconciliation. Preserve the independent
publication-confirmation work and obtain legitimate ordinary account/inbox
access and historical provenance. Fixtures/server/provider evidence does not
prove email receipt, browser sign-in, Checkout, natural cron or a real incident.
Recurrence remains untouched and no future execution is guaranteed.
