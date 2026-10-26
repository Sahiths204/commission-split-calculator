import { defineConfig } from 'vitest/config';

// Falls back to the local dev DB only when DATABASE_URL isn't already set (e.g. by CI's own
// Postgres service) — never override an environment-provided value.
export default defineConfig({
  test: {
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgres://postgres:csc_dev_password@localhost:5433/commission_split_calculator',
    },
  },
});
