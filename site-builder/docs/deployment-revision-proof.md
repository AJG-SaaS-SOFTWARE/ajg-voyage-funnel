# Deployment revision proof — 20 October 2026

`verify:deployment` now requires the expected revision, when supplied, to be a
full lowercase 40-character SHA and compares it by equality. A deployed short
prefix, malformed value or different full SHA cannot pass. The health response
must positively identify `ajg-site-builder`, `ok: true` and a ready database.

The existing explicit `--allow-unknown-sha` inspection remains available only
for an absent revision, not a malformed or contradictory one. Its JSON reports
`revisionVerified: false`; the same is true when no expected SHA was supplied.
The production workflow already supplies its full `GITHUB_SHA` without this
override. Existing FR/EN, canonical-route and unauthenticated denial checks stay
in place. No application route, Auth, RLS, billing entitlement or sales gate changes.

Tests execute the real script with isolated HTTP responses, including old false
positives, fail-before-network invalid inputs and the complete positive route
sequence. They do not prove browser login, email delivery, Checkout or historical
ticket provenance. This tooling-only change does not require a production deploy.

Access checkpoint: Cockpit `8fb3fb9c594c1eaf93d598785a86594f4458f6a1` docs still name private Blob as canonical;
the prepared Neon schema is not an alternative source for #525/#526. No private
data, roles or credentials were changed. Those cases remain open without their
own exact provenance. The ordinary receiving-email identity remains unavailable.

Next: consume the strict revision proof on the next genuinely required release;
resume the ordinary customer journey only with an authorized receiving mailbox.

Validation checkpoint: 1,174 local tests pass, including seven new script-level
cases (all seven fail against the baseline verifier). The updated verifier ran
read-only against the official production URL on 20 October at 04:40 UTC:
`revisionVerified: true`, served and expected SHA both
`8eb3308c70f7c574382806f295370483f5e73621`. This is a public HTTP/route and
revision observation, not a new deployment or an authenticated customer journey.
Exact-head CI, merge and remaining quality gates are recorded in the PR.

## Canonical redirect boundary — follow-up

The verifier now also requires canonical redirects to use the exact HTTPS
origin with no credentials, query or fragment, in addition to the existing
hostname and pathname checks. A matching hostname alone admitted HTTP, alternate
ports and decorated URLs. The localized 404 probe previously followed those
destinations; the pricing probe instead fetched a fixed HTTPS URL and could
hide a bad redirect behind a healthy canonical page. Both paths now refuse the
unsafe target before following or reporting success. Refusal messages no longer
echo the raw 404 Location (which might contain private values).

Both 307/308 remain supported, including safe same-origin relative locations.
A second redirect still fails rather than being followed. Five new behavioral
cases execute the full script with isolated HTTP for public, pricing and FR/EN
404 paths, including downgrade, alternate port, credentials, query and fragment.
The existing exact-SHA checks remain intact. This is release-tooling only: no
middleware, customer redirect, DNS, Auth/RLS or sales setting is modified.

Access remains bounded: no authorized ordinary receiving-email identity was
provided, and the historical GitHub issues still omit the private provenance.
They remain open; no synthetic journey or healthy probe substitutes for that
evidence. Test/CI/review and public read-only observation are recorded in the PR.
Fresh access observation on 20 October: the existing Cockpit production alias
returns HTTP 401 without credentials, while ELTARA `/login` returns HTTP 200.
No email was sent, no existing account reused and no authentication bypass tried.
The two new negative redirect cases fail against the exact #546 baseline;
all 12 verifier cases and the six existing route/source checks pass locally.
