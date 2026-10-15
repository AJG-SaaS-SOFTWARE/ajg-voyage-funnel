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
