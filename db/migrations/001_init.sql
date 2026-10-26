-- 001_init.sql
-- Initial schema for the Commission Split Calculator.

-- Payees who can earn commission. A payee may optionally report to another
-- payee; the application layer (not this schema) is responsible for
-- enforcing that override hierarchies are only ever one level deep.
CREATE TABLE payees (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    commission_rate NUMERIC NOT NULL,
    manager_id      BIGINT
                        REFERENCES payees (id),
    CONSTRAINT payees_manager_not_self
        CHECK (manager_id IS NULL OR manager_id <> id)
);

-- A single commissionable event. Amount may be negative to represent a
-- refund or chargeback flowing back through the same payee.
CREATE TABLE transactions (
    id          BIGSERIAL PRIMARY KEY,
    payee_id    BIGINT NOT NULL
                    REFERENCES payees (id),
    amount      NUMERIC NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL
);

-- Audit trail of computed payouts: one row per payout component (a payee's
-- own base commission, or an override credited to their manager) derived
-- from a transaction.
CREATE TABLE payouts (
    id             BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL
                       REFERENCES transactions (id),
    payee_id       BIGINT NOT NULL
                       REFERENCES payees (id),
    type           TEXT NOT NULL
                       CHECK (type IN ('base', 'override')),
    amount         NUMERIC NOT NULL
);
