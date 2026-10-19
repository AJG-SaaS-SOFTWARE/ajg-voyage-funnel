# Release E2E: validate evidence as well as HTTP status

## Defect and correction — 19 October 2026

The release shell previously accepted any HTTP 2xx from the structural and
explicitly opted-in full-AI mirror. The runner can legitimately return HTTP 200
with no completed recipe: a provider blocker has `ok: false`, and cooldown or
exhausted retry budgets can yield `executed: false` with unvalidated plans.
Those responses must not make the release recipe step green.

The existing shell now runs `scripts/verify-release-e2e-result.mjs` after its
transport check. The validator requires the exact release SHA, expected mode and
AI policy, an affirmative result, and exactly one FR and one EN plan. Each locale
must either have `already_validated` journal evidence, or an executed successful
HTTP result. Executed work additionally requires confirmed cleanup. Missing,
duplicate, inconsistent or non-JSON evidence fails with a fixed diagnostic that
does not print the response body.

Cooldown, provider blockers and exhausted retry budgets remain in place. This
does not replay a recipe, reset its journal or budget, change authorization,
open Checkout or enable paid AI. A post-release evidence failure marks validation
failed; it retains the existing no-automatic-rollback policy for these steps.
Already-validated decisions still rely on the existing SHA/locale/mode-scoped
server journal lookup; this script does not independently query the journal.

## Verification

The behavioral tests execute both actual workflow shell blocks under Bash with
only curl replaced by a local HTTP-200 fixture. They make no external requests.
Before the change, 26 of 28 tests fail: the old shell accepts blocked, wrong-SHA,
wrong-mode, incomplete, failed-cleanup and malformed responses. All 28 pass after
the change, including fresh, already-validated and mixed-locale success paths.
These are controlled shell/JSON contract tests, not an actual provider or ordinary
email/browser/Checkout journey. Exact-head CI and eventual release evidence belong
in the PR before claiming production validation.

Baseline: merged #536 at `99fcc624150554cf65a7fddc45e69e1695bc213f`.
Production was last verified at `905c4c5737be0a70794c85cf01eafb0953aeff1c`;
#536's merged-commit CI was queued, with no runner steps executed. Do not equate
that queue with failure or publish until its gates pass. Historical #525/#526
remain open. No new private provenance, ordinary receiving recipe mailbox,
legal approval, paid inference or commercial opening is established here.
