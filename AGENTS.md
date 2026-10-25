# ELTARA autonomous development policy

This repository contains ELTARA in `site-builder/`.

## Mission
For tasks explicitly queued for autonomous development, inspect the request, reproduce the problem when relevant, implement the smallest robust change, add or update tests, run the quality gates, and leave the repository in a reviewable state.

## Hard boundaries
- Work only inside `site-builder/` unless the task explicitly requires repository-level documentation.
- Never change GitHub workflow files, repository secrets, billing, domains, production credentials, legal/fiscal text, payment prices, or destructive database migrations.
- Never disable tests, authentication, authorization, entitlement checks, rate limits, quota enforcement, audit logging, or security controls to make a task pass.
- Never expose or print secrets.
- Prefer backward-compatible database changes. Any destructive or irreversible migration is blocked for human review.
- Production deployment is never performed directly by this agent. The agent creates a branch and pull request; existing CI/deployment policy remains authoritative.

## Required engineering loop
1. Read the issue title/body and inspect relevant code.
2. Reproduce or characterize the bug/feature request.
3. Implement the smallest complete change.
4. Add/update automated tests.
5. Run:
   - `npm test`
   - `npm run lint`
   - `npm run build`
6. If a command fails, diagnose and fix the root cause. Do not suppress the check.
7. Summarize changed behavior, tests, residual risks, and any required human validation.

## Autonomous task contract
A task is eligible only when its GitHub issue has the label `agent:ready`.
The issue is the persistent source of truth. A run may be interrupted at any time; therefore:
- keep work in a dedicated Git branch,
- make changes atomic,
- ensure the issue remains sufficient to resume,
- never rely on chat-only context.

## Completion
A task is complete when code and tests are ready in a pull request and all required local checks executed by the workflow pass.
