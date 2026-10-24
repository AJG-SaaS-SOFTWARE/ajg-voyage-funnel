# ELTARA security dependency update — 24 October 2026

Baseline: main/release/production `ad868e4939f23b4ef922e3dd1ea57a816efb1185`.
This change is limited to site-builder package.json, package-lock.json and this
checkpoint. No runtime source, workflow, Auth/RLS, schema, secret, permission,
customer record, offer or price changes.

## Evidence and correction

The baseline locked audit reported four affected package entries: Next critical,
PostCSS high, Sharp high and source-map-js high. These classifications are registry
advisories, not a count of distinct production exploits or evidence of compromise.
The publisher's image-optimization advisory includes Next 15.5.26 and recommends
Next 15.5.28 / Sharp >=0.35.5:

https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw

Versions in this change:

| Package | Before | After |
| --- | --- | --- |
| next | 15.5.26 | 15.5.28 |
| eslint-config-next | 15.5.26 | 15.5.28 |
| sharp | 0.35.4 | 0.35.5 |
| source-map-js | 1.2.1 | 1.2.2 |
| postcss (Next dependency) | 8.4.31 | 8.5.31 |

Next remains on version 15. Its 15.5.28 package still pins PostCSS 8.4.31;
updating Next alone left the Next/PostCSS advisory entries unresolved. An explicit
override scoped to Next's PostCSS replaces that old pin with 8.5.31, within the
same PostCSS major. It adds no direct runtime dependency and does not affect
other projects. The override must be reviewed when a future Next 15 release
ships a corrected native pin. Publisher reference:

https://github.com/postcss/postcss/security/advisories/GHSA-6g55-p6wh-862q

The final local `npm audit --json` reports zero known advisories on this lock.
This is a dated observation, not a guarantee of no vulnerabilities. No exploit
was attempted, and no force/major audit upgrade was used.

## Verification

Run the existing 1,392 tests, TypeScript, lint, production build and full HTTP
release smoke on the exact lock. Retain the 21 pre-existing lint warnings without
changing unrelated components. Local Node is 24; exact-head CI uses Node 22 and
is required before integration.

The FR/EN smoke's `/builder` loading-state assertion requires the same public
synthetic Supabase configuration as CI at build time. The initial local build
without these placeholders rendered the unconfigured path and failed that
assertion; no application or test assertion was loosened. Rebuild and run the
smoke with the checked-in CI's synthetic environment. No real mailbox or
production credentials are involved.

Use only the existing release/site-builder-production circuit after exact-head
and merged-main CI succeed. Confirm CRON_SECRET presence through decrypt=false
metadata and an initialized backup before release, so no bootstrap/rotation is
needed. Keep paid-AI E2E skipped and Checkout closed; the established sandbox and
disposable FR/EN recipes still have to pass, with cleanup, for the deployed SHA.
Final CI/release/health evidence belongs in the PR checkpoint.

The worker proofs in Cockpit #273 and security update #274 remain independent.
No service identity or commercial agent is activated here. Historical #525/#526,
private provenance and ordinary email → browser → Checkout remain unproven.
