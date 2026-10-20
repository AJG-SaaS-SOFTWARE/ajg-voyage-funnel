# Runtime incident intake receipts — 20 October 2026

The runtime reporter no longer equates an HTTP success with a persisted Cockpit
incident. It requires the existing POST contract (201), positive envelope and
an open/triaged request with the exact product, source, external reference,
title and kind, plus a well-formed central request ID. The existing support
ticket receipt and support-resolution reconciliation are unchanged.

Unknown, missing, malformed or contradictory receipts stay unconfirmed. Raw
provider bodies are neither returned nor logged. The existing operations agent
therefore records `reported_to_run:false` and its existing fixed reporting-failure
reason when an incident lacks its receipt. This does not resolve the incident.
Non-incident observations still skip the POST; no extra request, retry, repair,
new ticket identity or schema is added. Redirects are refused on this POST.
The existing 2.5-second request signal also applies while reading the receipt.

Tests execute the actual reporter, then compose it with the actual operations
agent and an isolated journal port. They cover correlated receipts, every
identity mismatch, HTTP/HTML/JSON failures, lost responses and no replay. These
are HTTP/storage doubles, not a deliberately induced production incident or an
independent read of a real central runtime request. Exact CI/release and recipe
evidence belongs in the PR checkpoint.
Fourteen new behavioral cases pass; twelve fail against the exact #547 baseline.
The full local suite passes 1,193 tests. No production incident was generated.

Access checkpoint: the private Cockpit alias still returns 401 without an
available identity; ELTARA login returns 200, but no authorized ordinary receiving
email identity is established. No email sent or existing account repurposed.
#525/#526 remain open without exact private provenance; this reporter fix does
not supply it. No Auth/RLS/permissions/secrets, existing client data, price or
sales setting changes; no paid AI call or live payment.

Next: observe a naturally occurring incident receipt through existing authorized
operational evidence, without manufacturing an incident; continue the ordinary
email/browser/sandbox journey only once its legitimate identity is available.
