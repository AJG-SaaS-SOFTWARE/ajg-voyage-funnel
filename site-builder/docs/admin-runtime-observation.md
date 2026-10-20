# Admin runtime observation coverage — 20 October 2026

The admin support GET previously mapped only runtime warning/incident into its
global summary. With all three platform probes green, an unknown runtime could
therefore become global healthy. The page also printed zero from any raw
healthy status, even when the observation was unchecked or truncated. Two
behavioral tests fail against the exact #551 route/page: falsely healthy API
summary and a misleading zero in the rendered actual admin component.

A small shared pure policy now requires `checked === true`, `status === healthy`
and `truncated === false` before confirming healthy. Unchecked, unknown or
incomplete non-error observations stay unknown. Checked warning/incident
evidence remains visible even in a partial sample: partial logs may prove an
observed error, never an absence of errors. Neither the raw observation, counts,
metadata nor the Vercel reader is rewritten.

The admin GET now returns at least warning on unknown coverage, with a fixed
action asking to check log collection and explicitly not claiming an outage.
Known app/domain failure handling and observed error priorities remain. The
page uses the same policy, renders a dash rather than a healthy zero on uncertain
evidence, and retains confirmed zero/error counts and the existing partial-sample
note. API shape, queue/KPI, thresholds, Auth/RLS, database queries, permissions,
secrets, collection budgets and all repair/report/cron behavior are unchanged.

Eight new tests cover strict flags, null/unknown evidence, observed severity,
unmodified inputs, the actual GET with isolated auth/query/probe ports and the
actual TSX page rendered with isolated hook state. The two baseline regressions
execute #551 sources, not a rewritten facsimile. Renderer fixtures are not a real
admin session or browser. The previous structure assertion now checks the
shared-policy call rather than requiring the old direct raw-status branch.

Access/baseline: Builder main/release/production
13d367225cdd8bd7a9211d1e974234908db51979, deployment
dpl_4fzuS9LRoTvfyCb9RpLJQ2rbcanc; CI39402759515/release39403070695/
public capture39403543865 SUCCESS. Natural uptime39404775512 also SUCCESS;
that does not certify the RUN cron or an authenticated admin view. Public
health 10:31:55Z confirms exact baseline SHA/deployment and service/database OK.
Private login still requires an invited email; no authorized ordinary receiving
identity/inbox is established, no email sent or existing account reused. Private
intake HTTP401; #525/#526 remain open without private provenance/resolution.
Cockpit main8fb3fb9c594c1eaf93d598785a86594f4458f6a1/checks and open PRs reviewed,
untouched. Separate worktree preserves earlier local work.

Validation: 1226 local tests, TypeScript, lint without errors (21 existing
warnings), production build and full HTTP smoke pass. Exact remote PR/main CI
and guarded existing publication remain required. No production observation
is edited to create a failure and no global RUN/repair is manually invoked.
No paid AI/live payment/purchase/message/sales opening, new infrastructure,
customer-data/history, SDK/dependency, DNS, price/offer/legal identity change.
Recurring configuration is unchanged and no execution guarantee is made.

Limits: this is presentation/aggregation coverage policy, not an upgrade of log
sampling, clocks, retention, completeness or the underlying runtime API. It
does not certify continuous uptime, a natural incident, external DNS, customer
satisfaction, central closure or email/browser/Checkout. Follow-up remains
legitimate ordinary-account/email/browser access and private historical
provenance, otherwise an independent reproducible issue. Do not redo the
already-delivered #551 probe or run a paid/real incident to produce evidence.
