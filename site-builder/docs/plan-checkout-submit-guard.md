# My plan — shared checkout guard, 19 October 2026

## Baseline and boundaries

ELTARA main/release/production `7184a7ed13bd155a6e4079acd66b1914ce2e5528` (#534) revalidated. All 550 tracked site-builder source blobs in the isolated local baseline match the GitHub tree. Main CI 39263178549, release 39263552024 and visual review 39264034410 succeeded. Public health at 14:35:37 UTC serves this SHA / `dpl_8QyjJBB64XSAkHxiKwLk7WTi1C8t`, service/database OK. Cockpit main remains `8fb3fb9c594c1eaf93d598785a86594f4458f6a1`, with its exact-main CI and PostgreSQL recipe successful. Open draft product/Business OS branches and dirty worktrees were preserved.

Browser login remains invitation-only, with no authorized ordinary recipe identity and receiving mailbox established; no email was sent or existing account reused. #525/#526 remain open with no new public reference/repair proof. The natural RUN cycle at 14:15:35 UTC still reports one productSyncFailure and two stalled work items. No historical callback, diagnostic, reset, recreation or closure was requested. Prior provider-backed sandbox proof and preconfirmed disposable fixtures do not prove email/browser Checkout.

## Defects and change

The separate My plan handlers relied on React's `checkoutBusy` state only. Rapid or stale handlers could open multiple payment flows across subscription changes and AI Creation. The website selector remained usable during an opening, and old payment handlers could act on the previous site after selection/read failure. Caught exception text was exposed directly.

The page now shares one immediate ref lock across subscription Checkout, AI Creation Checkout and the existing-subscription Customer Portal path. The selector is frozen while opening, including stale selection callbacks. A second ref identifies the latest successfully loaded billing site: invalidated synchronously before each account read, set only after the sequence-protected successful read, and checked by both payment handlers. A stale handler cannot use an earlier site even after the new site's read finishes. Loading/errors/missing site and beta exclusions remain in force.

On opening failure, controls are released with fixed FR/EN guidance that confirms neither purchase nor plan change. No automatic retry occurs. Successful navigation retains its lock until leaving the page. The existing helpers, server ownership and subscription guards, Checkout gates, Stripe routing, webhooks, prices/offers and legal/tax settings are unchanged. Stripe guidance informed keeping fulfillment/server rights out of the UI. No Auth/RLS, secret, permission, schema, customer-data mutation, live payment, provider call or paid inference is part of the code/tests.

## Verification

- Ten new behavioral cases failed against the old implementation; after the fix all pass. Tests transpile the actual complete TSX page with isolated hooks and client boundaries. They cover both entry orders, cross-action/portal exclusion, retained success guard, FR/EN exception privacy and manual retry, stale selector callbacks, stale-site actions before/after read, and failed account verification.
- Existing readiness, beta exclusion, subscription routing and stale-read tests remain enabled; their harness is updated to supply the new refs, without removing assertions.
- Full local suite 968/968; TypeScript, lint (zero errors, 21 existing warnings), production build, local HTTP release smoke and whitespace checks pass. Complete exact-head remote CI is required before merge; final evidence is recorded in the PR.
- Synthetic client tests do not prove browser authentication, actual Checkout interaction, server idempotency, cross-tab/process exclusion or absence of all duplicate provider effects. A never-settling request remains pending. No paid AI call, new infrastructure, price/identity change, commercial opening or production client mutation is authorized by these tests.

## Handoff

Review the exact remote diff, require full CI on its exact head and merged SHA, and publish only through the existing isolated ELTARA circuit with paid AI disabled. Confirm served SHA, actual sandbox provider execution (not a skipped step), durable FR/EN recipe journals and cleanup before declaring release verified. Next, establish a legitimate invited recipe identity with a mailbox before attempting the ordinary email → browser → sandbox Checkout → server rights → publication story. Historical provenance and exhausted AI credit remain separate blockers. Preserve recurrence and keep sales closed.
