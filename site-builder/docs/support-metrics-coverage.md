# Support KPI source coverage — 20 October 2026

The four admin KPI queries previously applied row limits but accepted every
successful result as a complete source. A server Data API cap below the requested
limit can silently omit an admin-touch event or truncate the ticket denominator.
The unmodified #549 route reproduces this: a response containing zero rows and
an exact count of 1001 still returns numeric metrics instead of withholding them.
This is a synthetic regression, not a claim about current production volume.

The same four bounded queries now request `count: "exact"`. Only an array whose
length equals its nonnegative safe-integer count is complete. Missing/invalid
counts, null data or mismatched counts withhold all KPI; source errors remain
unavailable. An exact complete result at the cap is accepted, including zero
rows/count zero. This detects server caps as well as caller limits without
unbounded pagination, extra requests, schema changes or new dependencies.

The additive `metricsStatus` field distinguishes complete, incomplete and
unavailable. The admin page explains incomplete coverage rather than displaying
partial percentages. The operational ticket queue and platform diagnostics stay
available; existing authorization, query windows, row budgets, queue contents,
calculation formulas and repair behavior are unchanged. Exact counts may cost
more database work than an uncounted select; no new infrastructure is provisioned.

Six new behavioral tests cover each source, invalid count/data, exact-at-cap,
server cap below caller budget, errors and preserved inputs. They execute the
actual route with isolated ports (13 response cases plus unauthenticated access),
and the installed Supabase SDK with an isolated HTTP response verifies count
headers, filter, limit and Content-Range interpretation. One route regression is
red against #549 because it returns numeric KPI from partial source data. The
other new guard tests are not claimed as pre-existing baseline functionality.

Local validation: 1207 tests, TypeScript and lint without errors pass (21 existing
warnings); configured production build and full HTTP smoke also pass. Exact
remote PR/main CI and guarded publication remain required before completion.
Official Supabase select docs and current changelog reviewed; no relevant JS
count API change identified. No live database read or mutation is needed to
reproduce this query-response completeness defect.

Limits: four queries are not a shared transactional snapshot; exact counts prove
row coverage only for each filtered response, not audit retention, correctness,
lifetime admin-touch absence, customer satisfaction or central resolution. There
is no automatic pagination, repair or reset on incomplete evidence. Queue counts
remain counts of the existing 100-row queue, not a newly certified global total.
An authenticated admin browser view has not been verified in this session.

Access checkpoint: Builder main/release baseline 846dd978690ce115b3b0b1cb3a426bbbe6cd3971
and Cockpit main 8fb3fb9c594c1eaf93d598785a86594f4458f6a1. Latest PR/CI/release
proofs reviewed; other open branches preserved. Public login HTTP 200 explicitly
requires an invited receiving-email address; no authorized ordinary fixture
identity/inbox is established. No email sent or existing account reused. Cockpit
intake returns HTTP 401 unauthenticated. #525/#526 remain open without private
provenance/resolution proof. Public health confirms the baseline deployment with
service/database OK. No Auth/RLS, secrets, permissions, customer data, history,
price/offer/legal identity or sales settings changed, and no paid AI call.

Next: exact-head review and full PR CI, guarded merge, full main CI and one
existing isolated sandbox release if gates pass. Record publication and its
limits in the PR. Pursue ordinary-email/browser/Checkout and private historical
provenance only through legitimate access; this KPI guard does not unblock them.
Recurring development configuration is unchanged; no invocation guarantee.
