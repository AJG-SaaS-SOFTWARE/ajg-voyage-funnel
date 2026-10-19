# Release-readiness canary network boundary

19 October 2026. Scope: the existing admin-only diagnostic's HTTPS canary.

## Reproduction and correction

The readiness route interpolated `domains.hostname` directly into a fetch URL.
`kind=managed_subdomain`, verified and primary database flags are not network
destination validation. Synthetic route executions demonstrated requests for
outside hosts, IP literals and URL-confusion input; no hostile input was sent
to any actual destination. A 3xx response was also reported as a passing canary,
despite the existing manual redirect policy not verifying its destination.

`managedCanaryUrl` accepts only a bare ASCII DNS hostname with valid label/total
length, a single valid slug below the existing trusted published roots, and an
exact HTTPS URL round trip without credentials, port, path, query or fragment.
It rejects schemes, userinfo, suffix lookalikes, nested slugs, addresses and
malformed hostnames before fetch. Current preferred/legacy root configuration
and existing display/routing helpers are unchanged. The validated canonical URL,
not the raw stored string, is the sole fetch target. An invalid or uncertain
lookup produces a fixed warning, no probe and no raw invalid hostname in output.

Redirects remain manual; only 2xx passes. Redirect/error/transport outcomes warn,
with fixed diagnostics that exclude Location and raw exception details. The
seven-second timeout, no-store, exact admin/JWT admission, query filters and
single-candidate lookup remain. No fallback scan, second probe or follow-up
redirect is added. No database, DNS, domain, secret, permissions, Auth/RLS or
customer-data mutation is made.

This narrows the stored-data network boundary; it is NOT DNS/IP pinning or proof
against compromise/misconfiguration of the trusted root DNS/configuration.
A 2xx canary proves a bounded response from an allowed hostname, not page content,
correct site ownership, every customer domain, external DNS completeness, the
ordinary login/Checkout journey or a historical incident's resolution.

The policy follows the primary
[OWASP SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
on syntax, destination allowlisting and disabled redirects. Vercel Domain guidance
keeps domain registration/assignment/DNS and an HTTP observation distinct; no
provider configuration is changed. Supabase query semantics and security guide
reviewed; role validation and selected-column query remain unchanged.

## Verification and checkpoint

The initial23 actual-handler cases had17 failures before correction and23 passes
after. HTTP/SDK doubles execute the real readiness handler and real target helper;
adversarial strings never perform DNS or a real network request. Additional cases
cover backslashes, encodings, Unicode, whitespace, trailing dots and configured
preferred/legacy roots. Access-denied/lookup-failed/transport/redirect cases remain
required. Exact-head full CI, merged-main CI, isolated release and independent
production checks must be recorded in the associated PR before claiming release.
No real invalid hostname is inserted into production for this test.

Baseline main/release/production6c7827e7f00801e4f641762341555e2e4c467842 (#540),
release39312864591 and visual39313364855 SUCCESS, journals279FR/280EN support and
cleanup pass. Fresh public health20:31:29Z confirms that SHA and service/base OK.
Cockpit main8fb3fb9c594c1eaf93d598785a86594f4458f6a1 and open PRs rechecked untouched.
Full ordinary receiving-email identity/browser/Checkout remains unavailable from
authorized evidence; #525/#526 remain open without private source provenance.
No paid AI, live payment, purchase, price/legal or sales-opening change. Existing
paid-AI cron removal remains intact; recurring development task untouched.

Next: complete this increment's gates; pursue legitimate ordinary-email/browser
access when established, otherwise independent RUN work grounded in new evidence.
