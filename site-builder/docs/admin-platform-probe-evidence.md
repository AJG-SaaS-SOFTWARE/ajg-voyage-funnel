# Admin platform probe evidence — 20 October 2026

The admin support route's separate platform probe accepted every HTTP status
below 500 as `https: ok`, without checking the `/api/health` body. Thus a redirect,
401/404 or HTML200 could appear green in the admin platform overview. Seven
behavioral regressions fail against the exact #550 inline probe; this is an
isolated reproduction, not evidence of a current production outage.

The probe is extracted into a server helper and now requires HTTP200. The two
application health probes additionally require JSON with `ok: true`,
`service: ajg-site-builder`, `database: ok`, `environment: production`. The managed
canary remains an HTTP200 reachability check, not a JSON application-health test.
The existing three configured hosts/paths, DNS resolver behavior, manual
redirect mode, no-store GETs, user agent and five-second HTTP deadline remain.
No redirects are followed, no retry/repair is added. Reading health JSON stays
inside the deadline and is limited to 16 KiB of streamed bytes, even when the
Content-Length header is absent. Refused or consumed streams are canceled and
their reader released; arbitrary response bodies/errors never enter output.

The existing four-field probe shape is preserved, including the observed HTTP
status on body failure. Existing admin severity aggregation is unchanged: a
refused application probe escalates its existing UI signal, but it is not proof
that production is down. The next-action copy now asks to verify the expected
HTTP/health response instead of diagnosing every refusal as a TLS failure.
Runtime evidence completeness/global-status policy remains a separate follow-up.

Eleven new behavioral tests execute the real helper (isolated DNS/fetch ports)
and actual admin GET composition: real positive contract, redirects/errors,
HTML/non-JSON/malformed/missing/negative evidence, canary200, oversized/chunked
streams, DNS/transport/body errors, active deadline/cancellation, no retries,
no raw body disclosure, unchanged queue/KPI and unauthenticated denial before
network or database access. Seven cases are red on #550. Existing KPI tests
now mock the extracted probe boundary without weakening their coverage checks.
No database query, schema, authentication, authorization or RLS changes.

Access checkpoint: Builder main/release baseline
7f3151904c700bf82b7402f37202b1e5cfd5ab8a; exact CI39394848044,
release39395214556 and automatic visual39395608893 all SUCCESS. Public health
09:35:02Z confirms baseline SHA/deployment dpl_93tTU8DK46UjFSTjxMkGiDM7udxn,
service/database OK. Cockpit main8fb3fb9c594c1eaf93d598785a86594f4458f6a1
and checks remain green; open PRs reviewed and untouched. Separate worktree
preserves prior local changes. Public login still requires an invited email;
no authorized ordinary receiving identity/inbox is established, no email sent,
no account reused. Private intake returns401. #525/#526 remain open without
their private provenance/resolution; no reset/recreation/assumed test origin.

Validation: 1218 full tests, TypeScript, lint without errors (21 existing
warnings), production build and full HTTP smoke pass. Exact remote PR/main CI
and guarded existing release remain required. No live response is
altered to test a failure. Synthetic helper/route tests are not an authenticated
admin browser session, a natural incident, an actual cron invocation, external
DNS certification or email/browser/Checkout proof. This is distinct from the
already-delivered customer diagnostic, uptime, release and KPI guards; those
implementations are not redone. DNS configuration, secrets/permissions,
customer data/history, prices/offers/legal identity and sales settings are
unchanged. No paid AI, live payments, third-party messages or purchases.

Next: review exact blobs and full CI; expected-head merge only green, then main
CI and one existing isolated/sandbox release. Record actual publication,
provider/structural cleanup and limitations in the PR, without a duplicate
deployment or manually triggering a global cron. Pursue ordinary-email/browser
access and private historical provenance only through legitimate access.
Recurring configuration is unchanged; no future execution is guaranteed.
