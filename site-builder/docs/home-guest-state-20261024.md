# Home guest-state correction — 24 October 2026

## Problem and scope

On published Builder `c4d307be47b8ae1d6feeec315e6593604e8db867`
(#585), the anonymous FR/EN home page displayed a temporary connection failure.
The condition was already visible before #585; the dependency update did not
introduce it. This increment changes only the home presentation of an explicitly
missing session. It does not modify the shared repository, login flow, Supabase
client configuration, sessions, server authorization, RLS, credentials or pricing.

## Reproduction and behavior

The installed `@supabase/supabase-js` 2.117.2 returns
`AuthSessionMissingError` from `auth.getUser()` with an empty session and zero
provider requests. The unchanged `getCurrentUser()` wrapper throws that error;
the home page previously classified every thrown error as unavailable.

The home page now uses the SDK's `isAuthSessionMissingError` predicate only
around its user lookup. This yields the existing guest state, sign-in link and
local draft. No account/site/entitlement read or product event follows the
missing-user outcome, and no AI/publishing capability is granted.

The SDK also normalizes an authoritative HTTP `session_not_found` response to
this class; that signed-out outcome deliberately shows the guest journey too.
A `bad_jwt`, missing refresh token, provider 503, network exception or ordinary
error merely bearing the same name still shows the error and retry action.
The existing timeout, late-result rejection and successful retry remain covered.

## Verification and evidence limits

- Two FR/EN regressions failed on the original page (`error` instead of `guest`)
  and pass after the correction.
- 13 targeted tests execute the actual home component and unchanged repository
  wrapper. Empty-session cases use the real installed SDK and in-memory storage;
  provider cases use the real SDK with synthetic HTTP responses and one mocked
  GET. They do not contact a Supabase project or change an existing identity.
- Full unit suite, lint, TypeScript, production build and FR/EN HTTP smoke are
  required; exact CI, release, visual evidence and final counts are in the PR.
  A first local smoke without the synthetic server env returned the expected
  unconfigured export 503; the unchanged smoke is rerun with the CI placeholders.
- Public production health and SHA are checked independently after release.
  Screenshots cover public FR/EN desktop/mobile surfaces, not a signed-in client.

Access revalidated: Cockpit private `/api/run/intake` returns HTTP 401 without
credentials; #525/#526 remain open. There is still no explicitly authorized
ordinary recipe identity and mailbox for received email → browser login →
Stripe sandbox Checkout → server rights → publication. This UI fix does not
supply that proof. Sales stay closed and paid AI is not invoked.

## Sources and next action

- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Supabase error types](https://supabase.com/docs/guides/auth/debugging/error-codes)
- Installed SDK: `auth-js/src/GoTrueClient.ts` `_getUser`,
  `auth-js/src/lib/fetch.ts` `session_not_found`, and `lib/errors.ts` predicate.
- Changelog reviewed on 24 October, including the 12 October TLS cipher notice
  (removal no earlier than 10 November); it does not explain this local,
  zero-request missing-session result. No TLS or project settings changed.

Next action: verify the released guest banner and sign-in link in public FR/EN
captures. The full ordinary email/Checkout journey requires its own authorized
identity/mailbox; preserve its blocker and the separate historical RUN cases.
The dormant commercial pilot remains governed by Cockpit #273/#274 checkpoints.
