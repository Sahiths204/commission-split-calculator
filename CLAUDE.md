# Commission Split Calculator

A small, original portfolio project: given a sales hierarchy and a list of transactions,
compute exact payouts per person (base + manager override) with a full audit trail. Money is
handled as exact decimals; refunds/chargebacks reverse correctly.

This is a personal project, unrelated to any employer's codebase or business logic. Built from
scratch, generic domain.

## Stack
Node.js + TypeScript, PostgreSQL, minimal React frontend, Vitest, GitHub Actions CI, deployed
on Fly.io.

## Accounts
- GitHub: `Sahiths204` — verify `gh auth status` before any push; never push under another account.
- Jira: `sahiths204.atlassian.net`, project key `CSC` — tickets tracked there, not in this repo.

## Working process
- One ticket at a time, worked as a tree of agents: a root agent splits a ticket into chunks,
  each child splits further until a task is one checkable action, does it, and reports back.
  Parents verify by reading the artifact, not the summary.
- Engineering-standard skills only (`hive-technology-standards:*`, `hive-engineering:*`,
  `hive-qa:*`, `hive-database:*`, `hive-infra-devops:*`) — never business-specific `hive-*`
  skills (`hive-manager:*`, `hive-teams:*`, `hive-sme-*`, `hive-director:*`, `hive-components:*`,
  etc.). Those are proprietary to the employer and have no place here.
- Report which skill/plugin was used and what it gave, every substantive reply — including
  where it was wrong, stale, or thin.
- Minimal code, no dead code. Build exactly what the ticket needs.
- **Always invoke the generic `hive-*` engineering-standards skills** listed above for
  consistency, reusability, and test-first (TDD) guidance — don't skip them just because a task
  looks simple enough to write by hand.
- **For any UI/UX work: always open the page and check it** (dev server + browser), don't
  consider a UI change done from reading the code alone.
- **Everything configurable**: DB connection, ports, rates, and any other environment-specific
  value come from config/env, never hardcoded.

## Before starting new work (gate — not optional)
For a new project or a new feature area (not every small ticket within one already-scoped
epic): don't start implementing directly. First:
1. Coordinate with "Super" (the sibling chat handling business/client side) to get the full
   business requirement.
2. Decide architecture, folder structure, and prerequisites (installs, DB, services) based on
   that requirement.
3. For UI work, write design documentation for the pages before building them.
4. Get the operator's explicit confirmation on the above before writing implementation code.
