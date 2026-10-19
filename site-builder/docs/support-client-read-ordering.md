# Support client reads: current evidence only

19 October 2026. Scope: support-page display only, not central reconciliation.

## Reproduced problem

An initial GET can finish after the refreshed list following a confirmed POST.
Its old success replaces current history; its late HTTP401 hides the form; a
late failure replaces the newer ready view with an error. An HTTP200 missing
the expected envelope is also accepted as ready, potentially hiding history
or breaking rendering. Manual diagnosis can record success after a guest result
and displays raw HTTP error details on failure.

## Correction

Each `load` receives a monotonically increasing local version before session
lookup. Only the latest started read can apply its result, guest outcome or
failure. Both transport/session failures and the parsed response are checked.
An invalid tickets array, health checks array or diagnosis state is unavailable,
not an empty successful history. This is envelope validation, not a complete
deep schema validator for every ticket/check field.

`load` returns true only after applying a current valid result. Manual diagnosis
does not announce success for a guest or superseded read. Its failure message
is fixed and localized; raw provider/transport messages are not displayed.
No automatic retry, new request or network cancellation is added. Server JWT
verification, ownership, API methods, writes and admission rules are unchanged.

A confirmed POST remains confirmed if its history refresh is invalid. Existing
UUID reuse, positive pending-ticket readback, same-draft clearing and changed
draft protection remain intact. Versioning is in-memory within one mounted page:
it is not a server timestamp, durable ordering, cross-tab guarantee or identity
switch/revocation guarantee. Mutating repair/rediagnosis actions are not replayed
or redesigned. Never infer historical ticket resolution from this UI change.

## Evidence and release boundary

Eleven added behavioral cases fail on the old page. Tests transpile and execute
the actual page with isolated hooks/HTTP/session doubles: stale success, HTTP401,
HTTP503 and rejection; incomplete HTTP200; saved POST with invalid history; fixed
FR/EN errors. Additional FR/EN cases assert expired refresh does not record a
successful diagnosis. Existing idempotency/recovery tests remain required.
These are controlled client tests, not the ordinary receiving-email/browser/
Checkout journey. Complete exact-head PR and merged-main CI, existing isolated
release, health SHA, provider sandbox output, structural FR/EN journals and
deployment review must be recorded in the associated PR before claiming release.

Baseline main/release/production: e49ee37bd3e3ba11d2049517b3657ce91831898a
(#539), release39309266659 and visual39309809663 SUCCESS. Five live Vercel crons
were verified; paid AI recipe unscheduled and manual paid option default false.
No receiving ordinary recipe identity/inbox has been established through the
authorized evidence. Public issues #525/#526 only expose their intake IDs and
technical summaries, not exact private source provenance: keep both open.
No paid AI, sales opening, live payment, price/legal, customer-data, Auth/RLS,
permission/secret or infrastructure change. Other worktrees are preserved.

Next: legitimate receiving-email/browser access when available; otherwise narrow
independent RUN improvements grounded in current evidence. Do not repeat #530–#539
or treat technical fixtures as proof of the full customer journey.
