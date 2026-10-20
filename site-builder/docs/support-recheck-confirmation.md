# Customer support recheck receipt — 20 October 2026

The real support-page recheck handler previously accepted any successful HTTP
body, including a ticket from another reference or an unknown status. A failed
GET after a confirmed PATCH replaced the confirmation with a generic read
error. Session rejection escaped the handler and simultaneous clicks could
issue duplicate or cross-ticket PATCH requests before the button state updated.

The client now requires HTTP 200, the exact requested ticket ID and one of the
three statuses returned by the existing PATCH contract: resolved, diagnosed,
waiting_customer. An unknown response, invalid JSON, network failure or 5xx
requires reading the request list before another attempt; none confirms success
and there is no automatic PATCH retry. A synchronous local ref guard precedes
session lookup; every recheck button is disabled while the action is pending.
Session failure and missing/expired sessions release the guard safely.

Only the correlated status is applied locally. Untrusted returned message or
other ticket fields are not merged. A failed subsequent list refresh preserves
the received confirmation, marks the list unavailable and offers the existing
read/refresh action, not an apparent failed mutation. Diagnosed status asks for
team review without claiming a central escalation receipt. FR/EN messages stay
distinct for unconfirmed transport and confirmed mutation/read failure.

Thirteen targeted tests extract the actual TSX handler through the TypeScript
AST and execute it with isolated session, HTTP, state and list ports. Twelve
fail on the exact previous main page (d85828e7); all pass with the correction.
The remaining case preserves normal success behavior. Tests cover each status,
receipt mismatch, bad JSON, 202/5xx, duplicate/cross-ticket clicks, session
failure/retry, absent session/401, refused refresh and unmodified ticket fields.
The button-disable assertion is structural, not a real browser interaction.
No actual user ticket or ordinary browser/email account is used.

Baseline and access: main/release/production d85828e7e5d322b74b71da73dbe871e986b811c2
from #552, CI main39423460701/release39423745307/visual39424274382 SUCCESS.
Independent public health 2026-10-20T13:32:31.611Z confirms that SHA and deployment
dpl_AAYd1M1yfP4RkbHTTYpNVL58qFDT, service/database OK. Login HTTP200 remains
invitation-only; no authorized ordinary receiving identity/inbox is established.
Private cockpit intake HTTP401; #525/#526 must remain open without their own
provenance/resolution evidence. Cockpit baseline8fb3fb9c594c1eaf93d598785a86594f4458f6a1
is unchanged. Applicable instruction paths and current PRs were checked.
Separate worktree preserves the concurrent builder publication-confirmation
changes and earlier local work; do not duplicate or overwrite those changes.

Validation checkpoint: 1239 tests, TypeScript, lint (0 errors, 21 existing
warnings), production build and full HTTP smoke pass locally. Exact remote
CI/release must be confirmed before claiming publication; final IDs/evidence belong in
the PR checkpoint. No backend, database, dependency, schema, Auth/RLS, permission,
secret, repair, central reconciliation, ticket history/customer data, price,
offer, legal identity, external DNS or sales configuration changes. No paid AI,
live payment, purchase, third-party message or new infrastructure. Existing
sandbox/disposable release recipes only, without manual global RUN invocation.

Limits and next: this is client receipt/UX robustness, not proof of a natural
incident, authenticated browser, external DNS or ordinary email/Checkout flow.
No indefinite protection across remounts/tabs or bounded request deadline is
claimed. Preserve uncertain historical cases and pursue legitimate ordinary
account/inbox access; continue the independent publication-confirmation work
already underway. Recurrence remains untouched, without a trigger guarantee.
