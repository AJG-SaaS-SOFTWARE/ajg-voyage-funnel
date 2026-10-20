# Uptime: HTTP success is not application health evidence

20 October 2026. Dedicated ELTARA GitHub uptime monitor only.

The previous two health steps trust curl exit status alone. A302 is not a curl
`--fail` failure, and an HTML login/error page returned as200 can also pass. Both
false-green cases are reproduced using actual curl against an isolated local
HTTP server, not by modifying production routing or simulating a customer.

Both fixed, reviewed health URLs now require exact HTTP200 and JSON with
`ok:true`, `service:ajg-site-builder`, `database:ok`, `environment:production`,
a full lowercase40-character commit SHA and a syntactically valid deployment ID.
Redirects are not followed. Missing, malformed, incomplete, wrong-service,
preview or negative health evidence fails the step. Response files are limited
to16KiB, connections to5s and each HTTP attempt to15s. Existing retries remain.
Only whitelisted technical fields are logged; raw response bodies are not.

There is intentionally no comparison with GitHub main: operational-only changes
can be merged without redeploying the application. The returned revision proves
the response identity, not that a desired release, global uptime or customer
journey has been validated. This monitor does not test email reception, browser
sign-in, Checkout, data isolation or backup completeness/restoration.

Official-domain DNS remains a hard gate. Branded canary stays tolerant and the
legacy published-canary check remains unchanged. Schedule, time budget, existing
targets, no-auth public calls and retry counts remain. Checkout uses a pinned
existing v4 action without persisted credentials; no repository permissions,
provider configuration, secrets or Auth/RLS setting is changed.

Tests execute the actual two workflow shell steps with real local HTTP/curl,
including the old false-green baseline, plus pure/CLI validation and safe output.
The public-host URLs are replaced only inside isolated tests. No external DNS,
runtime route, production response, client data or cron is mutated.

Baseline main43a00c7c1c27366078b1f5273d196570ee6275f6 (#543), exact main CI
39354274934 SUCCESS. Application release/production c109dca8775e531c2219b6b4aad20b92c8a9dd7b
(#542), release39348445123/visual39348762150 SUCCESS, structural journals283FR/284EN.
Public health02:27:26Z confirms that app revision, service/database OK.
Cockpit main8fb3fb9c594c1eaf93d598785a86594f4458f6a1/open PRs/CI rechecked untouched.
Existing dirty worktrees preserved. No duplicate of#542/#543 and no new application
release required for publishing this GitHub-only monitor after exact PR/main CI.

Ordinary receiving-email identity/inbox remains unestablished in authorized
current evidence; email→browser→Checkout stays unproven. #525/#526 remain open
without exact private provenance/resolution. No paid AI/live payment/purchase,
prices/legal identity/customer-data change or sales opening. Record exact gates
and read-only live checks in the PR; natural scheduled execution remains distinct
from deterministic local/CI tests. Do not manufacture an outage to prove recovery.
