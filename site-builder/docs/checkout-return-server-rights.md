# Checkout return: server-rights confirmation

## Increment — 21 October 2026

The Billing return page previously treated `checkout=success` only as a routing
parameter and performed one billing read. It neither distinguished the browser
return from provider proof nor checked that server entitlements had become paid.
A delayed Stripe webhook could therefore leave an ordinary customer looking at
the free state with no explicit pending guidance.

For an owned site whose exact return URL contains `checkout=success`, the page
now reuses the authoritative `get_my_site_entitlements` read up to four times,
1.5 seconds apart. It confirms only an Essential or Growth entitlement with an
active or trialing server status. On confirmation it refreshes the billing state
and says only that server-side entitlements are confirmed. If all bounded reads
remain free, unavailable or inconclusive, it says that rights are not yet
confirmed and asks for a later manual refresh. It never infers payment success
from the URL, never retries a payment mutation and never grants rights.

The check is not run for cancellation, ordinary page visits, missing `siteId`,
or a requested site not owned by the signed-in account. Changing site or
unmounting still cancels stale UI application. Existing Stripe webhooks remain
the source of fulfillment; this browser read only observes their server result.

## Verification and boundaries

Behavioral tests transpile the complete Billing page and cover delayed rights,
the four-read bound, fixed 1.5-second intervals, cautious FR copy, and forged,
cancelled and ordinary URLs. Existing site-selection, stale-read and error cases
remain enabled. Full tests, types, lint, build and exact-SHA CI are required
before merge and production release.

No Stripe session, payment, email, Auth/RLS, schema, secret, permission or
customer record is created or changed by this increment. It does not prove an
email was received, a browser opened Checkout, a sandbox payment completed, a
webhook arrived, publication succeeded, or historical requests #525/#526 were
resolved. Those proofs remain separate. Sales stay closed and paid AI remains
disabled.
