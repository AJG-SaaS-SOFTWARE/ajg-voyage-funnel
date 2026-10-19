# Billing portal submission guard — 19 October 2026

## Baseline and scope

Main and production were revalidated at `f9b45b5bfaf3986156e14b7754b289743b89fa67` (#533). PR CI 39254627066, main CI 39254848250 and release 39255137249 succeeded. Vercel deployment `dpl_55dFPt8FiMuysg8CkxpAMiesLSSu` is READY. All 548 tracked site-builder source blobs in the isolated local baseline match this GitHub tree. Concurrent worktrees and open draft product/Business OS PRs were preserved; this increment changes no cockpit runtime.

The ordinary customer journey is still blocked at the invitation-only login: no authorized invited ordinary recipe identity with a receiving mailbox is established. The production browser was opened read-only; no login email was requested. Provider sandbox lifecycle evidence from #533 is not browser email/Checkout evidence. #525/#526 remain open; their current bodies/comments provide no exact private product reference or repair proof. No new diagnostic or historical callback was dispatched.

## Defect and change

`manageBilling` relied only on a rendered disabled button, so two clicks before React committed its next render could call the portal endpoint twice. Site selection remained available while an opening was pending, allowing the visible account to diverge from the account being opened. Provider exception text was rendered directly.

The billing page now takes an immediate ref lock before the first await. The selected site cannot change during an opening, including a stale selection handler invoked before rerender. A successful navigation request retains its lock until the page is left; a rejected attempt releases the lock for manual recovery. The action remains disabled while billing is loading, and a missing Stripe account cannot start it. The localized error makes no claim that payment changed and never renders the caught exception. No automatic retry is introduced.

The existing portal helper, authenticated request, server ownership checks, Stripe customer mapping, Checkout, webhook rights and commercial gates are unchanged. No Stripe API version/SDK update, provider call, email, paid inference, price, tax/legal identity, credential, Auth/RLS, schema or existing client-data mutation is part of this change. Stripe guidance informed retaining the existing Customer Portal boundary, not moving entitlements into the browser.

## Evidence and limits

- Before the fix, five of six new actual-component behavioral tests failed: duplicate calls, selection locking, FR/EN exception disclosure and loading-state controls. The missing-account control passed already.
- After the fix, the six tests and the existing four selection-race tests pass. They transpile the actual TSX with isolated hook/client boundaries; they do not send Stripe requests.
- Full local suite: 958/958 pass. TypeScript, lint (zero errors; 21 existing warnings), production build, local HTTP release smoke and whitespace checks pass. The first smoke used a build without the workflow's placeholder configuration and failed at the Builder loading text; rebuilding and running with the existing CI placeholder environment passed without changing any assertion. Exact-head remote CI must also pass before merge.
- This is a tab-local UI guard, not server idempotency, multi-tab exclusion or a complete browser/provider payment journey. A never-settling request remains pending; no speculative timeout/retry was added. No new production payment or ordinary customer login is proven.

## Handoff

Review the exact remote diff and complete CI before merge. Publish only through the existing ELTARA release branch/circuit, with paid AI disabled and isolated recipe cleanup verified. Record the final SHA, release and served-version proof in the PR; until then this increment is not published. Continue the ordinary email → browser → sandbox Checkout journey only after a legitimate recipe mailbox and invited identity are established. Keep sales closed and historical cases open without their own evidence.
