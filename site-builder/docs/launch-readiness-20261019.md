# ELTARA — limited launch target, week of 19 October 2026

Updated: 14 October 2026. This is a conditional target, not an approval to open Checkout.

## Scope

Invite a small first group (2–3 customers/testers). Keep the current offer and server-side rights. Commercial outreach and unrestricted autonomous sending remain outside this technical launch. A limited launch does not establish complete business autonomy, margin or 98% satisfaction.

## Evidence currently available

- Production commit 76bee16a verified on the public ELTARA domain: health/DB, FR/EN pricing pages and admin access rejection.
- 748 local tests and complete exact-head CI for PR #483.
- Two ELTARA sandbox subscription invoices inspected on 14 October; one paid and one void. Both footer fields are null. This does not establish 293 B invoice proof.
- Provider lifecycle recipe now requires attributed paid sandbox invoice footer evidence and successful cleanup before success. Its mocked tests are not a provider execution or a rendered PDF check.

## Required launch gates

| Gate | Required evidence | State |
| --- | --- | --- |
| Billing | Actual sandbox payment, renewal failure, recovery and cancellation; matching server rights | Existing probes; fresh complete recipe pending |
| Invoice | New paid test invoice with the approved footer; PDF visually checked and business details complete | Blocked: inspected footer fields empty |
| Rights and AI | Paid plan enables only its rights; trial/unpaid states block variable-cost operations; quotas and costs visible | Automated code tests available; complete account recipe pending |
| Customer journey | Account → editing → publication → public pages on the intended domain; FR/EN and mobile | Complete account recipe pending |
| Support and RUN | Customer ticket → diagnosis → safe action or escalation → verified outcome → cockpit status | Complete incident recipe pending |
| Operations | Rollback target retained, monitoring works, critical alerts visible, support contact usable | Public health verified; complete incident recipe pending |
| Commercial opening | Business/legal inputs complete, invoice proof established, live configuration explicitly reviewed | Not approved by this document |

## Working target

- 15–16 October: finish supplier/payment and invoice checks; resolve technical blockers; gather missing business inputs.
- 16–18 October: run the complete customer and support journeys on isolated test data; fix critical failures.
- Week of 19 October: invite the first group only after all launch gates are evidenced. Expand after feedback and real cost observations.

If a gate remains unproven, keep commercial Checkout closed and continue the free beta. Do not substitute an approval flag, a unit test, a paid invoice from an older drill or a healthy homepage for the missing evidence.
