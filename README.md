# Commission Split Calculator

[![CI](https://github.com/Sahiths204/commission-split-calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/Sahiths204/commission-split-calculator/actions/workflows/ci.yml)

**Live:** https://commission-split-calculator.fly.dev/

Given a sales hierarchy and a list of transactions, computes exact payouts per person (base +
one-level manager override) with a full audit trail. Money is handled as exact decimals —
refunds and chargebacks reverse correctly, with no floating-point rounding error.

A personal, from-scratch portfolio project built over six nights. See [CLAUDE.md](CLAUDE.md) for
the stack and working process.

## Status

- Night 1: repo, DB schema, CI skeleton, first test — done
- Night 2: calculation engine (base + override payout, refund reversal) — done
- Night 3: edge-case hardening (rounding, one-level-override proof, validation) — done
- Night 4: REST API + PostgreSQL + integration tests — done
- Night 5: frontend (payees, transactions, paginated audit trail) — done
- Night 6: deployed to Fly.io (backend + static frontend, Neon Postgres) — done
