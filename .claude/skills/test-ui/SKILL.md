---
name: test-ui
description: Test the Commission Split Calculator's frontend end-to-end in a real browser against the live API and Postgres. Use whenever asked to verify the UI, after any frontend change, or before marking a UI-touching ticket Done.
---

# /test-ui

Delegates to the `ui-tester` subagent (`.claude/agents/ui-tester.md`), which starts the API and
frontend dev servers against the local Postgres container, opens the real running page, and
exercises every flow by hand: payees, a base+override transaction, a refund (checking it's the
exact negation of its original and stays paired with it), pagination, an error path, console/
network errors, and both a desktop and a phone width.

## When to invoke this skill
- Right after implementing or changing any frontend code in this project.
- Before marking any UI-touching Jira ticket (CSC-6's subtasks, or any future UI work) Done.
- Whenever the operator asks "does the UI work", "test the frontend", or similar.

## How to invoke
Launch the `ui-tester` agent (via the Agent tool, `subagent_type: ui-tester`) with a prompt that
states:
- What changed since the last UI test (so the agent knows what's new to focus on, not just the
  full checklist blindly).
- Any known current limitation (e.g. "pagination not implemented yet, skip that check") so the
  agent doesn't report a false failure for something out of scope.

Read the agent's report when it returns. Per this project's working process, treat the agent's
PASS/FAIL claims as a report to verify, not as ground truth for anything you'll tell the operator
is "confirmed working" — for a specific disputed or surprising result, open the page yourself and
check the one thing in question before relaying it as fact.

## Non-negotiable
A ticket is never marked Done for UI work based on code review or a passing unit test alone — only
after this skill (or an equivalent live check) has actually run against the real page.
