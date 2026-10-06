# Beta and commercial billing readiness

## ELTARA

The free Site Builder experience is a qualitative preview only. It must let a tester inspect representative paid value, but it must not unlock production-grade hosting or costly actions before payment.

Free preview users can:

- create and edit a draft site;
- inspect the preview experience;
- import limited content when the entitlement allows it;
- start the paid checkout flow.

Free preview users cannot:

- publish or host a public site;
- attach a custom domain;
- export a recovery archive;
- collect live public leads;
- consume any AI generation operation before an active paid entitlement;
- receive the Growth annual AI Launch benefit before successful payment.

Invited Beta Testers are the explicit exception: their beta entitlement resolves to `growth / active`, so the full test path remains available without creating a Stripe subscription.

There is no Stripe free trial for Site Builder Growth. The conversion path is preview first, paid subscription before production hosting.

## Stripe sandbox cycle

Before commercial launch, validate the complete sandbox cycle on the production-like deployment:

- successful subscription checkout;
- webhook attribution to the right site and owner;
- `invoice.paid` renewal handling;
- `invoice.payment_failed` past-due handling;
- immediate suspension of costly AI features after payment failure;
- publication / export / domain restrictions for non-paying users;
- recovery after successful payment retry;
- cancellation and end-of-period behavior;
- one-time AI Launch purchase and entitlement consumption.

## Wellness coordination

Wellness SaaS billing is separate from Wellness operational billing.

- SaaS billing: AJG charges practitioners for Wellness access.
- Operational billing: practitioners invoice or charge their own clients / patients.

The correct Wellness production alias is:

`https://wellness-crm-iota.vercel.app`

The Wellness SaaS Stripe webhook must target:

`https://wellness-crm-iota.vercel.app/api/saas-billing/webhook`

Wellness keeps a 14-day SaaS trial policy. Site Builder does not.

## Go-live blockers

Do not switch to live Stripe billing until these checks are complete:

- correct Stripe webhook domain for each tool;
- live secrets stored only in Vercel, never in source or chat;
- sandbox checkout, failed payment, recovery and cancellation proofs archived;
- Cockpit visibility for subscriptions, failed payments, support tickets and beta status;
- VAT / Stripe Tax decision validated before collecting live payments.
