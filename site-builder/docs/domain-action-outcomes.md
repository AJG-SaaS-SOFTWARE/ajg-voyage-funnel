# Domain action outcomes — 18 October 2026

## Reproduced problem

On main `156ca04813a265fc180b9d6a1d13534b2ca6a7b5`, the Domain page placed
the mutation and subsequent display refresh in a single catch block. A successful
removal followed by a failed read could therefore claim removal failed and invite
another attempt. It also passed success messages to CustomerErrorHelp, whose
domain-word rule classified them as problems. A failed site switch was not caught
and could leave the selector inconsistent with the displayed data.

## Implemented behavior

- A domain action is invoked once. Its acknowledged result and the subsequent
  read are tracked separately; no mutation is automatically retried.
- A lost action response stays unconfirmed. The UI does not claim rollback,
  success or an unchanged domain. A successful action followed by a failed refresh
  is reported as acknowledged, with stale display data.
- Both cases block add/verify/remove and site switching until the explicit
  read-only refresh succeeds. The same-tick action lock also prevents double clicks.
- Read retries only load sites, domains and entitlements. They never call the
  request, sync or removal functions. A missing selected site is not silently
  replaced by another site; all view data are committed only after successful reads.
- Success and uncertain-mutation messages are not fed to the generic error helper.
  The direct Health Center link remains available. FR and EN have matching next steps.

This is client-side UX and duplicate-action prevention, not a new authorization or
server idempotency guarantee. Existing backend owner/plan/domain checks are unchanged.
No DNS, domain registration, Auth/RLS, secret, payment or customer data was changed
by implementation or local tests. AJG Voyage and pricing/legal sources are untouched.

## Evidence and limits

The local site-builder baseline was reconstructed from the authorized GitHub
connector and its complete subtree hash compared to main:
`59fd2c999b8829c8cc8f6e12d7d7dabc9e3ce1f3`. Unrelated root files are not part of
the proposed patch. AGENTS.md is absent from the repository tree.

Behavioral tests execute the real helper and transpiled page with isolated React
hooks/repository ports: FR/EN success, acknowledged action plus failed refresh,
same-tick duplicate events, read-only retry, uncertain mutation and missing selected
site. These are component/port simulations, not a live DNS or browser/account recipe.
The complete local suite has 915 passing tests. TypeScript and lint pass (21 existing
warnings); the build and exact-head CI results must be read in the PR.

The release circuit is not harmless: its billing/provider smoke endpoints create
and delete disposable Auth users, and the structural recipe can provision an
ordinary account. The current task explicitly withholds Auth/business-data changes
without specific authorization. Therefore this change is prepared for review/CI
but must not be merged into the automatically released main branch until that
fixture scope is explicitly authorized or a separately authorized non-mutating
release path is available. Do not bypass or weaken release gates to publish it.

The 15:15 Paris RUN cycle still records one real product-sync failure, no routing
or corrective-agent failure. #525 and #526 remain unclosed. Their private per-request
observations are behind unavailable application authentication; no alternate read
route, credentials extraction or forced replay was introduced. The diagnostic for
#526 is an execution proof, not a verified correction. AI credit exhaustion remains
the last verified provider state, and no paid AI request was made.
