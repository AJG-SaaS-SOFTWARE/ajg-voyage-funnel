# Scheduled support completion

The scheduled domain repair previously called the repair engine without a ticket ID. Its audit could not satisfy `resolve_verified_primary_support_repair`, so the verified completion protocol from #528 did not run for scheduled repairs.

The sweep now selects at most two domain tickets for each eligible owned site and proceeds only when the lookup is available and unambiguous. A single diagnosed/waiting_customer ticket is bound to the repair audit before mutation. Missing tickets preserve ordinary maintenance without claiming closure. Ambiguous, foreign, terminal or malformed snapshots block that site's mutation. Custom domains, ambiguous domains and cooldowns retain their existing guards.

After a verified and audited successful repair, the sweep runs the existing health diagnoser, the existing SQL-backed resolution verifier and its independent ticket/event readback, then the existing central confirmation protocol. The SQL still requires the matching repair audit, exact ticket version and ownership, published live site, healthy domain/render/backend evidence and no custom domain. No migration, access rule or resolution code is changed.

The result distinguishes `succeeded` (domain repair), `ticketsResolved` (product resolution proven), `centralResolutionsVerified` (central completion independently confirmed), `ticketCompletionFailures` and `skippedTicketBudget`. A failed selection or completion makes the result non-OK and persists a fixed error category through the existing operations journal; provider contents and ticket identities are not added to logs. No failed or uncertain effect is replayed within the sweep. Independent sites continue.

The existing scan limit (50), repair limit (10), rotation and cooldown remain. At most two linked repairs are attempted per cycle to bound added central-confirmation time; deferred sites remain eligible in later rotating windows. This is not a distributed lease or a guaranteed wall-clock deadline.

## Validation and limits

- Behavioral tests execute the real Supabase JS client with synthetic HTTP responses and the real resolution verifier: scoped bounded selection, ordering, audit binding, exact CAS, independent readback, negative evidence, uncertain responses, continuation and linked-work cap.
- PGlite executes the unchanged resolution migration against isolated synthetic tables. An unlinked system audit cannot resolve the ticket; a matching linked audit can resolve it once. Stale versions, foreign ownership and a newly configured custom domain cause no resolution writes.
- Full local tests, types, lint and production build are required, followed by CI on the exact PR head.
- This does not establish the provenance or resolution of historical #525/#526, a natural cron repair, browser checkout, email login or external DNS repair.
- If product resolution succeeds but central completion is unconfirmed, its durable evidence is retained and the cycle reports failure. A later repair sweep does not replay the mutation merely to obtain another completion attempt. The bounded central reconciliation described below can recover the confirmation independently.

## Controlled scheduled recipe

The structural release retains the FR customer-triggered repair and assigns EN to the actual scheduled sweep executor restricted to its one disposable owned site. `runSupportRemediationSweepForSite` constrains both count and site reads by site ID and owner ID, rejects invalid UUIDs and missing/broadened scope, then runs the same eligibility, cooldown, ticket selection, repair and completion implementation used by cron. It exposes no new HTTP endpoint or caller-supplied release target.

The recipe still creates its ticket with the ordinary customer token, verifies the original central intake receipt, independently checks domain/public content and customer-visible resolution, and checks the durable repair's `trigger_source=system` in scheduled mode. Cleanup remains blocked until the independent central resolved readback succeeds. No global sweep is used by the recipe. A passing release proves this scoped system execution, not an hourly cron firing or external DNS repair.

## Recovering uncertain central confirmation

`support-central-reconcile.ts` runs after product reconciliation in the existing authenticated operations agent. It counts and rotates through at most 20 terminal domain tickets with the verified primary-repair resolution code, selecting at most two per cycle. Both the window and its selected slots rotate so already confirmed prefixes cannot permanently hide older pending rows.

Before any network completion, it requires the exact original system intake receipt (including complete count evidence), one current system resolution audit, its linked successful repair audit, and matching owner/site/ticket/version. A missing ticket, ambiguous or truncated receipt, stale/user-authored audit or unverified repair cannot qualify. It never recreates tickets, reopens or rewrites product state, reruns repairs or dispatches corrective agents.

The exact authenticated central GET is read first. A verified resolved receipt needs no POST. A positively identified open/triaged receipt can receive one idempotent completion POST, whose existing receiver independently rereads the product proof and uses CAS. Unknown, absent, mismatched or resolved-without-proof receipts never authorize a POST. A lost POST response is checked by GET only; no second POST is sent in that invocation.

After confirmation, the product ticket is independently reread to reject a changed version. A system diagnostic marker (`ajg-run-resolution-confirmed`) binds the request ID, product version, resolution event and repair run. The insert must return matching persisted evidence. Lost marker acknowledgements are not replayed within the cycle; a later marker read can discover the committed evidence. Valid markers suppress further HTTP for that exact proof. Concurrent runs can append duplicate equivalent markers; no unique-write or distributed-lease guarantee is claimed.

The private operations result separates checked, confirmed, already-confirmed, newly completed and failed confirmations. Failures prevent a healthy operations result and persist a fixed error category in the existing journal. No schema change is required. The scheduled EN recipe additionally runs this same reconciler scoped to its one fixture, requires no completion POST on the already resolved receipt, and verifies the durable marker before cleanup. This real recipe covers the already-resolved reconciliation path; transport loss and pending-CAS recovery are exercised with synthetic HTTP in behavioral tests.

## Development scheduling

On 19 October 2026 the previous three-occurrence development schedule was observed disabled, with `last_run_time=2026-10-19T07:37:27Z` and `updated_at=2026-10-19T07:38:34Z`, before its first planned 10:30 Paris occurrence. The automation API supplies no actor or disable reason; expiration cannot be claimed as the cause. Alex requested ongoing work. The same automation was enabled with an hourly RRULE without COUNT/UNTIL. Its response still had no next_run_time. Continuous execution or reliable future triggering is not demonstrated.
