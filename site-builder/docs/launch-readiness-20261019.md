# ELTARA — limited launch target, week of 19 October 2026

Updated: 15 October 2026. Conditional target; no approval to open Checkout.

## Consolidated evidence — 15 October 2026, 05:58 UTC

**Commercial opening remains blocked.** A limited launch during the week of 19 October is conditional on the missing end-to-end evidence below. No claim of fully autonomous business operations, proven margin or 98% satisfaction.

- Main and release branch rechecked at `b913e81913e61525a5b639c9cf67e64234a84c9b`.
- Public /api/health: HTTP 200, database ok, same served SHA; active deployment `dpl_PfpCB7bB7dpmEGg8TiUAKqdhg1Pa`.
- /tarifs HTTP 200 lang=fr; /pricing HTTP 200 lang=en. Unauthenticated support tickets and admin support operations return 401.
- Public support health: HTTP 200/healthy. This measures current workload/availability, not successful resolution of a complete customer incident.
- Latest complete exact-head CI: [38684323706](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/actions/runs/38684323706), **775 tests, 775 passes, zero failures**, lint, TypeScript, production build and smoke passed before #493 merged.
- Night runtime changes were published directly through Vercel after CI. Post-deploy checks above were read-only. The billing mutation/provider recipes were not re-executed by those direct deployments.
- Previous complete release [38634562749](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/actions/runs/38634562749) remains the evidence for sandbox Checkout mutation smoke, injected billing transitions, signed AI Launch webhook, structural FR/EN and private cockpit reporting on `6a55d9ea`. Do not attribute those executions to the latest runtime SHA.
- Paid AI recipe remains opt-in/default false. No paid inference was requested for the night work.

### Completed night changes

| PR | Delivered behavior | Exact-head CI |
| --- | --- | --- |
| [#488](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/pull/488) | Reconciled launch evidence; green provider step explicitly distinguished from deferred recipe | [38657981922](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/actions/runs/38657981922), passed after documentation merge |
| [#489](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/pull/489) | Thrown repair preserves completed counters and permits independent sites to continue; no same-sweep retry | [38663220546](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/actions/runs/38663220546), 756 tests |
| [#490](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/pull/490) | Customer rediagnosis rejects stale same-status ticket updates without false resolution event | [38669112622](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/actions/runs/38669112622), 760 tests |
| [#491](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/pull/491) | Missing selected site cannot silently create a replacement; publication client behavior exercised | [38674350991](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/actions/runs/38674350991), 766 tests |
| [#492](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/pull/492) | Delayed RUN progress cannot reopen terminal tickets; duplicate transitions do not repeat writes/events | [38679521064](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/actions/runs/38679521064), 771 tests |
| [#493](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/pull/493) | Automatic reconciler preserves newer same-status ticket evidence | [38684323706](https://github.com/AJG-SaaS-SOFTWARE/ajg-voyage-funnel/actions/runs/38684323706), 775 tests |

#489–#493 merged only after their exact-head full CI passed. New regressions were first reproduced against the old implementation. Tests execute actual handlers/repository/reconciler with synthetic dependencies: they do not prove live Postgres concurrency, provider repair or a browser customer journey. Timestamp concurrency checks rely on all writers maintaining updated_at.

### Remaining launch gates and owners

| Gate | Current evidence | Next action |
| --- | --- | --- |
| Real Stripe sandbox lifecycle → server rights | Injected transitions and signed synthetic webhook passed on prior release; actual provider recipe DEFERRED | Human configures dedicated sandbox-only STRIPE_PROVIDER_E2E_KEY in GitHub Actions; then technical recipe must execute and prove attribution, transitions and cleanup. Never retrieve or paste its value. |
| Invoice | Two older inspected sandbox invoices had footer=null | Confirm seller legal identity; generate new paid sandbox invoice with approved 293 B footer; inspect complete PDF. Flags alone are not proof. |
| Customer publication | Prior structural FR/EN recipe; new client control-flow tests | Complete isolated normal-customer account → edit → publish → public page/mobile/rights recipe on current version. This is technical work still open, not a human approval substitute. |
| Support/RUN/cockpit | Synthetic handler, audit, ordering and failure tests; previous private cockpit reporting | Complete isolated ticket → diagnostic → safe repair/escalation → independently verified result → cockpit closure. Durable audit/report delivery after partial failure remains unproven. |
| AI costs/rights | Guard tests and missing-evidence checks | Complete isolated account/quotas recipe; real cost and quality measurements require separately authorized bounded inference. No margin claim. |
| Commercial opening | Remains gated | Human review of legal identity, invoice PDF and live payment configuration after technical gates pass. No price, fiscal or Checkout-opening changes authorized here. |

**Launch assessment:** a small first cohort during the week of 19 October remains possible, not confirmed. If invoice/provider or complete customer/support evidence is missing, retain free beta and keep commercial Checkout closed. Five reliability fixes and a healthy production service do not establish complete business autonomy.

---

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
