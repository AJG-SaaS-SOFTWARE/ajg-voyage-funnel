# ELTARA — limited launch target, week of 19 October 2026

Updated: 15 October 2026. Conditional target; no approval to open Checkout.

## Scope

Invite 2–3 first customers/testers only after the gates below pass. Preserve the existing offer and server rights. Commercial outreach, autonomous sending, live charges, pricing changes and migrations are outside this technical release. No claim of complete autonomy, proven margin or 98% satisfaction.

## Verified evidence

- GitHub main rechecked on 15 October: `6a55d9eadf92dddabb875d64c27df5f051fcd70c` (PR #487). PR #480, #481, #483, #485, #486 and #487 are integrated.
- [Release 38634562749](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/actions/runs/38634562749), completed successfully on 14 October at 20:46 UTC: deployment/public-domain verification, private cockpit reporting, sandbox Checkout mutation smoke, disposable injected billing lifecycle, signed AI Launch webhook and structural FR/EN recipe passed.
- Last completed local/CI suite: 755 tests. This document update does not represent a new test execution.
- Vercel production deployment `dpl_qYigr2Jc6ECgaJUYZqDigLwbAXN2` rechecked READY on 15 October. The release verified the served SHA; a fresh direct HTTP check from this workspace could not run because its network proxy was unavailable. READY alone does not prove current public health.
- Paid AI recipe explicitly SKIPPED. The current workflow requires manual opt-in and defaults to false; retain this protection.
- Provider-backed Stripe lifecycle is DEFERRED. Its workflow step reports success because the missing-key branch exits zero; that green step is NOT provider execution evidence. Logs explicitly confirm missing `STRIPE_PROVIDER_E2E_KEY`.
- Two older sandbox subscription invoices inspected on 14 October had null footer fields (one paid, one void). No approved-footer or rendered-PDF proof exists.

## Launch gates

| Gate | Tested / delivered | Remaining proof / blocker |
| --- | --- | --- |
| Billing and rights | Injected pre-payment, activation, failure/grace, recovery and cancellation; signed AI Launch webhook | Actual provider-generated sandbox lifecycle with matching customer/subscription/price and server rights |
| Invoice | Recipe requires attributed paid invoice, footer and cleanup | New paid sandbox invoice with approved 293 B footer, complete business identity and visual PDF review |
| AI rights / costs | Server guard tests; missing/invalid usage evidence rejected | Complete isolated account recipe; no paid inference authorized for this work |
| Customer publication | Structural FR/EN release recipe | Account → edit → publish → intended public pages, including mobile; complete customer journey not demonstrated |
| Support / RUN | Journal confirmation, access rejection, failed-repair propagation and cockpit reporting | Isolated customer ticket → diagnosis → safe action/escalation → verified result → cockpit closure |
| Operations | Release verification and rollback target capture passed | End-to-end incident/rollback exercise; current public health must be freshly checked |
| Commercial opening | Checkout remains gated | Legal identity, invoice evidence and explicit live configuration review; no approval granted |

## Required human inputs, grouped for review

1. Configure the dedicated sandbox-only `STRIPE_PROVIDER_E2E_KEY` in GitHub Actions secrets using the provider recipe's required scope. Never paste or retrieve its value in chat. Then execute and inspect the provider recipe; configuration alone is not a pass.
2. Supply/confirm complete seller legal details and approve invoice content after actual sandbox PDF inspection. Do not set fiscal approval flags as a substitute.
3. Review live payment configuration only after the complete rights, publication and support gates pass. No live opening is authorized by this document.

## Working target

15–16 October: remove technical blockers and collect provider/invoice evidence. 16–18 October: isolated customer and support recipes, then critical fixes. During the week of 19 October: limited invitation only if all gates are evidenced; otherwise continue the free beta. A healthy homepage, mocked test, old invoice or green release step that skipped work cannot replace missing evidence.


## 15 October — repair sweep partial-failure verification

Behavioral test executes the actual sweep with a rejected repair at the first, middle and last position. Completed successes and failed attempts remain visible, each isolated site is attempted once, later independent sites continue, and raw exception details are excluded from the result. The failed site's potentially partial action is not retried within that sweep. This proves control flow using synthetic dependencies, not a real provider repair, durable cross-process exclusion or the complete customer-ticket journey. Exact-head CI and deployment evidence are recorded in the associated PR.

Fresh public health verification on 15 October at 00:59 UTC returned HTTP 200, database ok and production SHA 6a55d9ea via Vercel web fetch.


## 15 October — customer ticket diagnosis concurrency

The actual PATCH handler is exercised against synthetic persistence. A newer update retaining waiting_customer must return 409, preserve the newer evidence and emit no resolution event. Unchanged owned tickets may complete; foreign tickets are rejected before diagnosis; failed writes emit no resolution. Regression reproduced as HTTP 200 with overwritten state before the fix, then HTTP 409 after matching updated_at as well as owner/status. This is optimistic concurrency using the existing timestamp, not a database version counter or a complete provider-backed support journey. Tests rely on writers maintaining updated_at; no schema migration or real ticket mutation is performed. Exact-head CI and public deployment evidence are retained in the PR.


## 15 October — publication client behavior

Six tests execute saveMySite with synthetic Supabase dependencies. Explicit missing/foreign site identities must not silently create a replacement; capability denial/unavailability stops existing-site writes; new publication inserts a draft before checking publish rights; authorized owned publication persists FR/EN and prepares the managed domain; unsigned clients cannot write. The first two tests reproduced unintended replacement creation before the guard and pass afterward. This is client repository control-flow coverage, NOT proof of database RLS, actual hosting/DNS, browser rendering or the complete customer publication journey. Existing server authorization remains required. No provider/domain/client-data mutation was executed by these tests. CI/deployment evidence is retained in the PR.


## 15 October — RUN support event ordering

Five tests execute the support-sync POST handler with synthetic persistence: delayed in_progress cannot reopen resolved/closed; repeated progress/resolution deliveries do not rewrite timestamps or emit duplicate transitions; simultaneous duplicate deliveries converge in the harness; write errors do not emit events; unauthorized calls instantiate no privileged client. Three regressions fail before the conditional update and pass afterward. The status exclusion is applied atomically in the update query, using existing columns. This is handler and query-construction coverage, not a live database concurrency exercise, durable event-delivery guarantee or proof that a closed RUN item was actually repaired. Complete incident repair verification remains open.


## 15 October — automatic reconciliation version check

Four tests execute the actual reconciler with synthetic persistence. A same-status newer ticket update is preserved and independent tickets still reconcile; unchanged tickets succeed; failed writes produce no resolution event; unconfirmed audit results make the cycle fail. The stale-evidence regression fails before comparing updated_at and passes afterward. The existing non-null timestamp is selected and matched in the update alongside owner/status, consistent with customer rediagnosis. No new schema, live ticket mutation or provider repair is involved. This relies on all writers maintaining updated_at and is not live database concurrency or complete support journey proof. PR retains exact-head CI and deployment evidence.
