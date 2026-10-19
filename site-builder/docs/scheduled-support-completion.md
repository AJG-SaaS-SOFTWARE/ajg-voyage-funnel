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
- This does not establish the provenance or resolution of historical #525/#526, a live scheduled repair, browser checkout, email login or external DNS repair. The existing structural release recipe exercises customer-triggered completion, not the scheduled scan.
- If product resolution succeeds but central completion is unconfirmed, its durable evidence is retained and the cycle reports failure. A later repair sweep does not replay the mutation merely to obtain another completion attempt. Recovery/reconciliation of that pending completion requires its own bounded, evidence-based increment.

## Development scheduling

On 19 October 2026 the previous three-occurrence development schedule was observed disabled, with `last_run_time=2026-10-19T07:37:27Z` and `updated_at=2026-10-19T07:38:34Z`, before its first planned 10:30 Paris occurrence. The automation API supplies no actor or disable reason; expiration cannot be claimed as the cause. Alex requested ongoing work. The same automation was enabled with an hourly RRULE without COUNT/UNTIL. Its response still had no next_run_time. Continuous execution or reliable future triggering is not demonstrated.
