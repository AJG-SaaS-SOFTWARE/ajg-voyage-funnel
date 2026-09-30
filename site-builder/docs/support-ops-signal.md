# Support operations signal

`/api/health/support` exposes a deliberately minimal, public operational signal for the AJG Infrastructure Cockpit.

It never returns ticket text, subjects, user IDs, site IDs, email addresses or exact counts. It only reports:

- service identifier;
- status: healthy, warning, critical or unknown;
- a generic operational summary;
- check timestamp.

Only tickets requiring AJG are considered: new, diagnosed and in-progress. Tickets waiting for a customer action do not create an AJG operational alert.

Escalation is deterministic:

- any actionable ticket -> warning;
- critical severity -> critical;
- high severity unresolved for 24 hours -> critical;
- any actionable ticket unresolved for 72 hours -> critical.

Database/configuration failure returns HTTP 503 with status unknown so the Cockpit treats the signal as unavailable rather than silently healthy.
