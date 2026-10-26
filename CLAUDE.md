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
- One ticket at a time, worked as a tree of agents, asynchronously: a root agent splits a ticket
  into chunks, each child splits further until a task is one checkable action, does it, and
  reports back. Parents verify by reading the artifact, not the summary. The root then runs the
  final tests, pushes, merges, and updates ticket status in Jira.
- **The one hard rule for the agent tree: never let two agents edit the same file at the same
  time.** Split chunks along file boundaries so this can't happen — don't rely on timing.
- Never business-specific `hive-*` skills (`hive-manager:*`, `hive-teams:*`, `hive-sme-*`,
  `hive-director:*`, `hive-components:*`, etc.) — those are proprietary to the employer and have
  no place here.
  **Correction (2026-10-26), updated: the "generic engineering-standards" namespaces are not
  reliably generic.** Two separate checks found real employer/product-specific content inside
  nominally-generic skills: `hive-qa:qa-base` named the employer and its lending platform
  directly; `hive-technology-standards:standards-typescript` mandated a specific internal stack
  (named frameworks, cloud services, ID-prefix conventions, a fixed layering scheme) that has
  nothing to do with this project. Two-for-two failures means the namespace tells you nothing —
  **default to NOT invoking any `hive-*` skill on this project.** Implement directly from the
  ticket's spec and ordinary engineering judgment instead. If you genuinely think a `hive-*`
  skill might help on something unusually tricky, read its actual content first, in full, before
  acting on any of it, and discard anything that names a real company, product, stack
  requirement, or business rule — then say in the handoff exactly what you kept and why.
- Report which skill/plugin was used (or that none was, per the default above) and what it gave,
  every substantive reply — including where it was wrong, stale, or thin.
- Minimal code, no dead code. Build exactly what the ticket needs.
- **For any UI/UX work: always open the page and check it** (dev server + browser), don't
  consider a UI change done from reading the code alone. Use the `/test-ui` skill
  (`.claude/skills/test-ui/`), which delegates to the `ui-tester` subagent
  (`.claude/agents/ui-tester.md`) — it starts the real servers, exercises every flow by hand
  (payees, base+override transaction, refund pairing, pagination, an error path, console/network,
  both a desktop and a phone width), and reports PASS/FAIL per check. No UI ticket is Done without
  this having actually run against the live page.
- **Everything configurable**: DB connection, ports, rates, and any other environment-specific
  value come from config/env, never hardcoded.

## Additional engineering discipline
Generic practices worth following here, adapted from prior experience (deliberately stripped of
any employer-, client-, or system-specific detail — nothing below names or implies a real
company, carrier, codebase, or dataset):
- **Money**: one exact-decimal type end to end, never a native float. Never parse a money value
  with `Number()`/`parseFloat()` — if a money value can't be read, it's an error, not a silent 0.
  Rounding happens exactly once, at a defined boundary.
- **Push discipline**: fetch + rebase before pushing, resolve conflicts (never discard someone
  else's committed work), run the full check suite on the rebased tree, then push. **Verify a
  push landed by reading the content back from the remote** (`git show origin/<branch>:<path>`),
  not by trusting the push command's own exit code.
- **Never pipe away a command whose exit code you need** (`cmd | tail` reports the last stage's
  exit code, not `cmd`'s). Run it, capture its own exit code, then do whatever formatting/piping
  you want with the output separately.
- **UI verification, not optional**: start the real dev server and look at the actual rendered
  page — at both a desktop width and a phone width for any screen touched — before calling UI
  work done. A green test suite is not evidence about a screen. If a UI looks wrong, check the
  server's own log for a real error before assuming the code is broken — a generic "something
  went wrong" message on screen tells you nothing.
- **Before building something, check it doesn't already exist** — grep for the underlying
  concern, not just an exact name match.
- **A relayed "it's fine" is not consent for a risky action.** If an agent in the tree correctly
  refuses something (a push, a destructive command) on its own safety grounds, don't argue it
  into doing it anyway — bring the actual work to a context that can get real approval.
- **Name the specific file/line/commit beside any claim about the code**, not just beside a
  number — "X doesn't exist" or "Y already handles this" are claims about a specific tree and
  should be checked that way, not asserted from memory.
- A flaky failure under concurrent load (e.g. several agents running tests at once) isn't
  automatically a regression — retry once in isolation before treating it as real.

## Before starting new work (gate — not optional)
For a new project or a new feature area (not every small ticket within one already-scoped
epic): don't start implementing directly. First:
1. Coordinate with "Super" (the sibling chat handling business/client side) to get the full
   business requirement.
2. Decide architecture, folder structure, and prerequisites (installs, DB, services) based on
   that requirement.
3. For UI work, write design documentation for the pages before building them.

**Operator confirmation (updated 2026-10-26):** only required before UI work — once a page's
design doc exists, wait for explicit approval before building it. For everything else (steps 1-2
above, non-UI implementation), proceed without waiting for a go-ahead each time.
