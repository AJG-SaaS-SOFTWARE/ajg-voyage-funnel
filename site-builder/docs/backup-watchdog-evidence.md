# Backup watchdog: unknown is neither fresh nor recovered

20 October 2026. Dedicated ELTARA watchdog only; no application backup writer,
restore, retention, data, credentials, permissions or Vercel configuration change.

## Reproduced in isolation

The old workflow coerces `ageHours:null` with `Number(null)` to zero and emits
`needs_recovery=false`. Its next successful branch reports a fresh backup even
when the API explicitly returns `status:unknown`. Its post-recovery condition
accepts any nonempty completion string different from the previous string,
including an older completion or another spelling of the same instant.

The reviewed helper now requires positive configured/ok evidence, a known state,
a finite numeric nonnegative age and a parseable completion not in the future.
Age/state contradictions block the job before health/recovery outputs. The
completion-derived age must agree with public age within 0.1h: public health
rounds to 0.1h, caches for 60s, and watchdog HTTP requests are bounded to 15s.
This is a metadata-consistency bound, not a future-date clock-skew allowance.
Unknown evidence fails closed; it does not authorize repair, initialization,
reset, recreation or replacement of the previous backup.

The existing >=36h watchdog recovery threshold is retained, based on the
completion timestamp. Known stale evidence still permits the existing guarded
backup cron only. Recovery success additionally requires a strictly newer
completion instant, healthy status and fresh evidence. Same-instant alternative
spellings, older/future/unknown/still-stale results cannot pass.

Only computed numbers/booleans and a canonical timestamp reach GITHUB_OUTPUT.
CLI errors use fixed text and never print source JSON. Requests have connection
and total timeouts; raw error/recovery response bodies are not printed. Schedule,
job timeout, concurrency, project/team, existing cron and polling budget remain.

## Verification and publication

Tests cover pure decisions, exact thresholds, rounding/cache tolerance, invalid
clocks, chronological recovery, CLI exit/output and the actual workflow check
step executed in bash with isolated curl fixtures. These do not call Vercel,
Storage, Supabase or a backup/restore cron. Full exact-head PR/main CI is required
before merging. Merging publishes this GitHub watchdog; no application runtime
change requires a redundant Vercel application redeployment. A read-only live
health check can validate the parser, not prove a naturally scheduled watchdog
run or a real stale-backup recovery. Do not deliberately corrupt live metadata.

Baseline app main/release/production c109dca8775e531c2219b6b4aad20b92c8a9dd7b
(#542), release39348445123 and visual39348762150 SUCCESS, journals283FR/284EN.
Public health 20 October01:26:54Z confirms exact app SHA, service/database OK.
Cockpit main8fb3fb9c594c1eaf93d598785a86594f4458f6a1 and current PRs/CI reviewed,
untouched. Existing worktrees preserved; no duplicate of #542's pure classifier.

No established authorized receiving-email ordinary fixture/inbox is available
in current access evidence. Email→browser→Checkout remains unproven; do not use
preconfirmed example.invalid accounts as that proof. Historical#525/#526 remain
open without their own provenance/resolution. No paid AI, live payments, sales
opening, prices/legal identity, Auth/RLS or customer-data change.

Record exact tested commit, PR/main CI, publication boundary and fresh read-only
health/evidence result in the associated PR. Next priority remains legitimate
ordinary-email/browser access and exact historical provenance; if unavailable,
continue independent evidence-backed work without replaying completed changes.
