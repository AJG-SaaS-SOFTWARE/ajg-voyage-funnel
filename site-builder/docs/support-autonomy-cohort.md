# Support autonomy KPI cohort — 20 October 2026

The admin support API independently selects tickets created in its 30-day window
and events recorded in that same window. An event can therefore refer to an
older ticket. The previous calculator added every system-resolution event to
the self-service numerator, even when the ticket was absent from the denominator
or had since reopened. One new resolved ticket plus two older resolution events
could report 300 percent. This is a reproduced synthetic defect, not a claim
that production currently displays that percentage.

The numerator now uses only the supplied ticket cohort, its current terminal
state (`resolved`/`closed`), and the existing absence-of-admin-touch rule.
Historical events or an old resolution code cannot override a current open
state. No artificial 100-percent clamp hides incorrect membership. Window-wide
activity counters (including work on older tickets), response fields, query
windows, database permissions and all support/repair behavior are unchanged.

Eight behavioral tests execute the real calculator for older, missing, reopened,
closed and admin-touched tickets; duplicate and reordered events; and unmodified
inputs. This tests arithmetic and membership using synthetic records, not an
authenticated admin browser session or a new real customer resolution.

Limits: the API's existing row limits and source-history coverage are unchanged.
The metric describes current terminal tickets in the supplied created cohort;
it does not independently prove customer satisfaction, audit completeness,
central closure or lifetime absence of human intervention. Incomplete source
coverage still requires its own gate, not inference from this correction.

Access checkpoint: private Cockpit still returns 401 without an available
identity; login ELTARA returns 200 but no authorized ordinary receiving-email
identity is established. No email sent or account reused. #525/#526 remain open
without their own private provenance. No customer-data, schema, Auth/RLS,
secret/permission, offer/price or sales-setting changes, and no paid AI call.
Exact tests, CI, publication, isolated recipes and next action belong in the PR.

Validation: 1,201 local tests pass; seven regression cases fail against the
exact #548 calculator baseline. Read-only RUN journal observation: cycle 326
completed at 07:20:25Z with `attention`, runtime `unknown` and fixed reason
`runtime_timeout` on the current deployment. This is an unavailable observation,
not a confirmed product outage, incident delivery, or proof of cron provenance.
No global cycle or repair was invoked to improve that observation.
