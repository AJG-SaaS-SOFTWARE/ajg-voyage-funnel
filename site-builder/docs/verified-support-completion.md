# Verified support completion before fixture cleanup

Pair with the cockpit's `resolve_support` intake action. Deploy that receiver
first. This changes the actual successful managed-primary-domain repair path,
not just recipe reporting.

After the existing SQL repair, ownership checks and independent product audit
readback succeed, the server reads the ticket's recorded central Intake ID.
An absent or ambiguous receipt prevents central completion. It sends only the
ticket/request pair; the cockpit independently reads a read-only proof from
`GET /api/run/support-sync?ticketId=...&requestId=...` using the existing token.
The health GET without query stays public; the exact proof GET requires token
authentication before creating a service client and returns no user content.

The proof requires the terminal product ticket, the automatic verified repair
code, its original central receipt, and a system resolution event for the
current ticket version. Old or unrelated audits, missing tickets, unresolved
states, unsafe numeric event IDs and failed reads cannot prove resolution.
No ticket write or repair occurs in the proof reader.

The producer accepts only an exact positive persisted completion receipt and
an independent central GET with status resolved and resolutionVerified=true.
The structural customer journey now requires both product and central
resolution before reporting success and releasing its cleanup guard. A lost
or negative acknowledgement does not replay the POST. If central completion
is unconfirmed, the ordinary account session is revoked but source account,
site and audit remain; the recipe records cleanup_failed and the retained
ticket ID. A later authorized reconciliation/cleanup must examine these
resources. Retry budgets remain unchanged. This trades disposable residue for
preservation of actionable source evidence; it never reports cleanup success.

Central resolution does not prove a linked GitHub issue has already closed.
The cockpit's next recovered-item pass performs that independently with its
existing issue correlation and response checks.

Historical #525/#526 stay open: a 404 is not evidence that either was a recipe,
and this implementation neither recreates nor resolves those missing records.
No credentials, Auth/RLS configuration, migrations, client data, pricing,
legal identity, AJG Voyage source or paid AI are changed. Standard releases
use only the existing isolated disposable/sandbox recipes; inspect their
actual results before calling this a production closure proof.
