import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill in a valid PostgreSQL connection string.',
  );
}

export const pool = new Pool({ connectionString });
