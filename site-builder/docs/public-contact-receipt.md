# Public contact: keep an accepted receipt, not an event object

20 October2026. Client component only; existing contact API/RPC/notifications,
abuse limits, consent, permissions, Auth/RLS, schema and stored data unchanged.

The actual React DOM package19.3.0 clears `event.currentTarget` immediately after
calling its listener (`react-dom-client.development.js`, executeDispatch). The
public form accessed that event again after awaiting its POST. A successful
server receipt could then be presented as an error on reset; an analytics throw
could similarly erase the visible acceptance. Batched state also allowed two
submissions before the disabled button was rendered. Reproduced with the actual
transpiled component, deferred requests, batched hook state and event lifetime.

Capture the form before yielding, acquire a synchronous local ref lock and freeze
inputs while sending. Accept the existing positive201/ok/UUID/sent-or-stored
receipt before best-effort reset/analytics. Their failures cannot downgrade it.
Success copy says recorded, not email delivered. Unknown transport/body/error
results keep the input and use fixed FR/EN uncertainty text, never raw details or
automatic resubmission. Known error codes use only own-property whitelist copy.

The existing honeypot200/suppressed behavior stays silent; it is not asserted as
a stored message and no longer emits a form_submit analytics event. This is not
a new backend persistence or notification guarantee. The local ref is not server
idempotency: reloads, multiple tabs and a later manual retry remain outside it.
No timeout/abort semantics, new retry or backend deduplication is introduced.

Tests run the actual component with isolated fetch/FormData/React-hook doubles,
capturing event.currentTarget clearance and pending state before render. They
cover FR/EN sent/stored receipts, duplicate attempts, input preservation, invalid
receipts, safe known/unknown errors, manual retry, suppressed honeypot and reset/
analytics failures. No customer/contact request or third-party message is sent.
Full exact PR/main CI and the existing isolated release are required before
claiming publication; record new health SHA, recipe journals and scoped logs.
These component tests are not an actual browser/email-delivery journey.

Baseline main443adb3a7fcf930b279144bc23e04d6a67e0b319 (#544),CI39359888702 green;
app release/production c109dca8775e531c2219b6b4aad20b92c8a9dd7b (#542),release
39348445123/visual39348762150 green,journals283FR/284EN. Fresh public health
03:28:17.380Z confirms baseline exact app SHA/service/database OK. GitHub-only
#543/#544 do not imply a newer app release. Cockpit main8fb3fb9c594c1eaf93d598785a86594f4458f6a1,
open PRs/main+PostgreSQL CI reviewed unchanged; existing dirty worktrees preserved.

Vercel deployment and Supabase security guidance reviewed; no provider/SDK/env
change. Supabase changelog reviewed (October14 .NET,October12 legacy TLS notice),
no relevant change to this client-only correction. No paid inference/live payment,
purchase,price/legal identity,customer-data mutation or sales opening. Authorized
receiving-email ordinary fixture/inbox remains unestablished; browser sign-in/
Checkout stays unproven and #525/#526 stay open without own private provenance.
Next: finish exact gates/publication, then legitimate ordinary-email/browser
access/provenance work or independent evidence-backed improvements. No duplicate
of delivered support reconciliation or login/billing fixes.
