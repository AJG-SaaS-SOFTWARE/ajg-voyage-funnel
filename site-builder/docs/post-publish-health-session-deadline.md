# Post-publication health session deadline — 20 October 2026

## Change
The manual post-publication diagnostic retry now bounds only the Supabase
`auth.getSession()` preflight to 15 seconds of browser timer activity. If the
session read or refresh remains pending, the UI settles to the existing
unavailable state; a late SDK success or failure cannot start a health GET or
restore stale evidence. An explicit later click may retry. There is no automatic
session or diagnostic replay.

Each retry owns and clears its timer. The existing request-version guard protects
a newer retry or automatic post-publication diagnosis from an older timeout.
Once a valid session is obtained, the timer is cleared before delegating to the
separately bounded 30-second GET delivered in #559.

This is a logical deadline around the Promise. Supabase does not expose an
AbortSignal for `getSession()`, so the SDK's internal storage/refresh work is not
cancelled. It may complete later, but this handler attaches no late continuation
that could issue the GET. No sign-out, refreshSession, setSession, user mutation,
Auth configuration, cookie/storage policy, token lifetime, RLS or permission
change is made.

## Current Supabase contract
The current official JavaScript reference was checked on 20 October 2026:
`getSession()` returns the stored session and refreshes it if necessary; its
session can be null. Its result is used here only to obtain a browser bearer for
a server endpoint that independently authenticates and checks ownership.
Reference: https://supabase.com/docs/reference/javascript/auth-getsession

The Supabase changelog Markdown endpoint could not be read by the available
reader because it returned an unsupported content type. The current reference
and session guide were retrieved through Supabase documentation search instead;
no relevant API change was found. The pinned dependency remains unchanged.

## Verification
A new test file extracts and transpiles the real `runPostPublishHealth` and
`retryPostPublishHealth` TSX handlers plus the actual diagnosis validator.
Controlled timers exercise both locales, pending session success/failure after
expiry, timer cleanup before the 30-second GET, explicit recovery, old/new retry
races, concurrent preflights, fast SDK outcomes, missing site/client and source
wiring that forbids Auth mutations. No real session or outage is induced.

The local repository/dependencies are not available in this execution workspace.
A preliminary in-memory diagnostic executed the exact handler text after removing
only TypeScript annotations with controlled timers and a synthetic AbortController:
baseline d094e6d97f4d07aa6ee20cc82c6b03caa7d3d8e5 fails 5/6 focused scenarios;
patched passes 6/6. This is not npm test, native TypeScript transpilation, React
rendering, a real Supabase refresh or browser evidence. Require exact-head CI
tests/types/lint/build/smoke, source review and complete merged-main CI before
release through the existing guarded pipeline.

## Baseline and blockers revalidated
Builder main/release/production are
`d094e6d97f4d07aa6ee20cc82c6b03caa7d3d8e5` (#559), with PR/main CI,
production release and visual review successful. Latest production deployment
`dpl_888DFZDTvEuD8SpGpL3qmuAqbYmW` is READY. Cockpit main remains
`8fb3fb9c594c1eaf93d598785a86594f4458f6a1` with its main CI/SQL recipe
successful. Complete repository trees contain no AGENTS.md. Open PRs and
unrelated branches are preserved; no overlapping session-health branch was found.

The authorized web reader still cannot retrieve the public login or private
Cockpit intake in this pass. This is a tool-access failure, not an HTTP status or
service-outage observation. No ordinary invited recipe identity with an
explicitly authorized receiving mailbox exists, so email delivery -> browser
session -> sandbox Checkout -> server rights -> publication remains unproven.
No existing customer/admin identity is reused and no auth restriction is bypassed.

#525 (`req_5cbfea80`) and #526 (`req_1b09b202`) were re-read open; their
canonical private provenance remains unavailable. No closure, reset, recreation,
guessed test attribution, permission change or additional 3/3 escalation occurs.

No schema, secret, customer/history, DNS/domain, price/offer, legal identity,
payment configuration or existing release recipe is changed. Sales remain
closed; no email, live charge, paid AI call or new automation.

## Limits and next action
The timer is active-time behavior: a suspended tab or blocked main thread can
delay it. The underlying SDK Promise is not cancelled. No cross-tab/remount or
unmount cancellation guarantee is added. The automatic publication path already
has an access token and is unchanged.

Next: obtain legitimate ordinary-mailbox/private-registry access before expanding
the customer or historical-ticket evidence. Independent reliability work should
not alter Auth to manufacture that proof.
