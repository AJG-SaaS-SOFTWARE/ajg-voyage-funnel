# Release recipe response and persisted evidence

## Increment — 19 October 2026

The mirror runner previously accepted a child HTTP 2xx with `ok: true`, without
checking its deployment, locale, mode or journal identity. A response from a
different deployment, or success without a confirmed journal row/cleanup, could
therefore be summarized as validation of the runner's own SHA. The release-shell
semantic gate added by #537 checks the summary, so it cannot detect this incorrect
attribution inside the runner.

For newly executed recipes, the runner now validates the child's SHA, locale,
AI/customer mode and positive journal ID. It independently reads the exact journal
row with ID, SHA, locale and AI-mode query filters, then checks those fields again
in the returned row. Success requires terminal `success`, a parseable completion
timestamp and exactly one passed cleanup step. A missing row, mismatched identity,
unfinished/failed journal, unconfirmed cleanup or failed read cannot produce a
green mirror result.

Unconfirmed evidence follows the existing orchestrator failure-journal path with
a fixed technical detail. That records the failure for the current SHA/mode's
existing cooldown and retry budget, rather than leaving a foreign response without
any failure record. The child is not replayed within the invocation; independent
locales continue and temporary orchestration admins retain their existing cleanup.
Failure-journal persistence itself still uses the existing insert behavior; this
change does not establish a distributed lease, exactly-once execution, or a new
guarantee for a lost audit-write acknowledgement. Already-validated decisions keep
their existing SHA/locale/mode-scoped journal lookup and do not create identities.

## Verification and boundaries

Twenty of the original 21 behavioral checks fail against the old actual runner;
the unchanged already-validated skip check passes. The corrected runner also has
a mixed-locale test, for 22 passing tests. They execute the complete actual runner
with controlled persistence/auth/HTTP ports, covering wrong identities, missing or
unfinished rows, invalid timestamps, missing/failed/conflicting cleanup and failed
reads. Full-mode coverage uses a synthetic provider-readiness port; it makes no AI
call. These tests are not a live outage or database concurrency exercise.

No schema, Auth/RLS configuration, secret/permission, price/offer, legal identity
or existing customer-data change. No paid inference, live payment, historical
request replay or commercial opening. The existing disposable release accounts
and sandbox circuit remain the only production recipe path used for validation.
Historical #525/#526 remain open without their own proof.

Baseline main/release/production `1ae7e1b59bd784b9adff0bbb18f7e50600c2c10d`
(#536/#537): release 39304106941 succeeded, with actual provider sandbox lifecycle
and structural journals 273 FR / 274 EN passing support and cleanup. Ordinary
receiving-email → browser login → Checkout remains unproven without an authorized
invited receiving recipe identity. Exact-head CI and new release evidence must be
recorded in this increment's PR before claiming deployment of this change.
