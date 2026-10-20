# Publication local single-flight guard — 20 October 2026

## Change
The mounted Builder publication handler acquires a synchronous useRef guard before waiting for the autosave queue, reading the session, promoting media or writing a site. Duplicate invocations return without clearing notices, releasing the guard, changing busy state or replaying follow-ups. The owning invocation releases the guard in its existing finally block after success, failure or secondary warning. Validation failures never acquire it. Existing remote confirmation semantics from #555 remain intact.

## Verification
Fourteen new behavioral tests extend the real handler AST harness (32 cases total in that file). They cover FR/EN waiting autosave, session, media, write and Growth stages, local cache reentry, manual retry after failure, validation, and guard release across existing failure/warning paths.
The local execution environment was unavailable. An in-memory diagnostic executed the actual extracted handler text with only its two TypeScript annotations removed, and the same synthetic fixture/test callbacks: 11 negative cases fail on exact baseline fc8844dff9306e9023af1924f51ad87d669fe848; 32/32 pass with this guard. This is not npm test, the TypeScript AST transpiler, a rendered React test or browser evidence. Remote CI must validate the committed files, types, lint, build and HTTP smoke before merge. No local build or full-suite success is claimed.

## Baseline and access
Builder main fc8844dff9306e9023af1924f51ad87d669fe848, CI39448454631/release39448925666/visual39449521450 SUCCESS; Vercel deployment dpl_D5oLocXeztnf7oGnka44Qz1PdsLJ READY on the intended Builder project/team. Cockpit main8fb3fb9c594c1eaf93d598785a86594f4458f6a1 unchanged; its latest main CI/SQL-recipe successful. Existing PRs preserved; no open overlapping Builder PR observed. No AGENTS.md found in either complete recursive tree.
No ordinary invited identity with an authorized recipe mailbox is established. Public login/health/intake retrieval by the web reader was unavailable during this run, so no new HTTP-status or authenticated-browser claim is made. Historical #525(req_5cbfea80) and #526(req_1b09b202) re-read open; private provenance remains unavailable, no closure/reset/recreation/attribution attempted.

## Scope and limits
Client guard only, mounted page only. No cross-tab/remount idempotency, timeout/cancellation, locking against other save/media operations, backend receipt validation or server exactly-once guarantee. No change to auth, permissions, secrets, RLS, Supabase SDK calls, database, managed domains, customer data/history, dependencies, offers/prices/legal identity, paid infrastructure, live payment, paid AI or sales gates. No email sent. Source writes performed on a dedicated remote Git branch because the local runtime is unavailable; no concurrent worktree modified.

## Next gate
Review remote diff, require complete CI on exact head and merged SHA, then only the existing isolated/sandbox release if gates can be checked. Record the outcome in the PR. The ordinary email → browser → Stripe sandbox → server rights → publication story and private historical provenance still require their legitimate accesses; fixtures and provider-only tests do not replace them.
