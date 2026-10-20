# Backup freshness: invalid time is not healthy evidence

19 October 2026. Scope: the pure freshness classification, not backup operations.

## Reproduced defect and correction

`Math.max(0, now - completedAt)` made a future completion timestamp appear to be
zero hours old and healthy. Implicit Date.parse coercion could also accept a
non-string JSON field; invalid observation clocks produced misleading outcomes.

Freshness now requires a nonempty string completion time, a finite parse result
not after the observation time, and a nonnegative safe-integer millisecond clock
within the ECMAScript Date range. A failed condition returns the existing
`unknown`/`ageHours:null`, not a fabricated healthy age or a stale-backup incident.
No skew tolerance or new state is introduced. The existing thresholds are exact:
age<=36h healthy,36h<age<=72h warning,age>72h critical. Date string parsing semantics
are otherwise unchanged; this is not a complete timestamp/calendar schema parser.

This does not correct the underlying source clock or rewrite its timestamp.
The actual status reader still returns the recorded completion field unchanged,
and consumers receive unknown freshness rather than successful freshness.
It does not prove backup completeness, successful restoration or new cron work.

No backup/restore/pruning/upload/manifest/DNS/API admission implementation changes.
Existing retention35days, paths, history and object contents are untouched.
The release bootstrap already skips when lastCompletedAt is a nonempty string;
an unknown freshness status alone is not permission to reset/recreate a backup.
No deliberately invalid production manifest is created for the test.

## Evidence and release boundary

Twelve added cases fail on the old policy.23 targeted tests pass after correction,
including original retention/path tests, millisecond-exact36h/72h boundaries,
future timestamps, non-string values, invalid/fractional/out-of-range clocks and
the actual getStorageBackupStatus reader. The reader executes with isolated Blob
responses and a fixed clock; tests assert two reads, zero mutations, zero SDK
clients, unchanged source timestamp/retention/count and preserved valid states.
These doubles never access a real bucket, customer object or Blob manifest.

The Date range is defined by
[ECMAScript TimeClip](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-timeclip).
Storage/deployment/Supabase guidance reviewed to preserve the current private
storage circuit and server-only credentials; no provider/SDK/configuration change.
Exact-head PR/main CI and the isolated release must pass before publication is
claimed. Record live health/version, public backup metadata read, actual provider
sandbox result, structural FR/EN journals and visual review in the associated PR.

Baseline main/release/production094c35dc249e53e95ad931d77e4538424e9709b5 (#541),
release39321353150 / visual39321854867 SUCCESS, journals281FR/282EN support+cleanup
pass. Fresh health21:30:47Z confirms baseline service/base OK. Cockpit main
8fb3fb9c594c1eaf93d598785a86594f4458f6a1 and open PRs rechecked, untouched.
No established authorized ordinary receiving-email identity/inbox is available;
email→browser→Checkout remains unproven. #525/#526 remain open without private
provenance/resolution evidence. No paid inference, live payment, purchase,
customer-data/Auth/RLS/secret/permissions/pricing/legal or sales-opening change.
Paid-AI cron remains unscheduled and recurring development task unchanged.

Next: finish this increment's gates; pursue legitimate ordinary-email/browser
access when established, otherwise narrow independent RUN work on new evidence.
