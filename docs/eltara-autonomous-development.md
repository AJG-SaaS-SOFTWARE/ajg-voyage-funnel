# ELTARA Autonomous Development Agent

## Goal
Continuously process ELTARA development, bug-fix and improvement requests without depending on a long-lived ChatGPT Work session.

## Persistent queue
GitHub Issues are the durable queue. Add the label `agent:ready` to authorize autonomous work.

The workflow can start:
- immediately when `agent:ready` is applied,
- manually with an issue number,
- hourly as a recovery mechanism for queued work.

This means an interruption, expired chat session, or Work limit does not destroy the task state.

## Execution
The workflow:
1. selects one authorized issue;
2. creates an isolated branch;
3. installs ELTARA dependencies;
4. runs Codex against `site-builder/`;
5. rejects protected-path changes;
6. runs tests, lint and build;
7. commits and pushes only after the quality gates pass;
8. opens a pull request;
9. moves the issue from `agent:ready` to `agent:review`.

## Required secret
Repository Actions secret:
- `OPENAI_API_KEY`

The Codex GitHub Action consumes this secret through its protected Responses API proxy.

## Recommended labels
- `agent:ready`: explicitly authorized autonomous task
- `agent:working`: currently being processed
- `agent:review`: PR created, awaiting CI/review/merge
- `agent:blocked`: human decision or external dependency required

## Safety boundary
The agent does not directly deploy production, edit GitHub Actions, manipulate secrets, change billing/prices, purchase domains, or execute destructive database migrations.

Production deployment should remain behind the existing tested merge/deployment path. Once the pipeline is proven stable, bounded low-risk auto-merge can be added separately.
