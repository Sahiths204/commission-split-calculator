import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const ALREADY_EXISTS_ERROR_CODE = '42P07';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and fill in a valid PostgreSQL connection string.',
    );
  }

  const migrationPath = path.resolve(process.cwd(), 'db/migrations/001_init.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(sql);
    console.log('Migration applied: 001_init.sql');
  } catch (err) {
    const pgError = err as { code?: string };
    if (pgError.code === ALREADY_EXISTS_ERROR_CODE) {
      console.log('Schema already applied, skipping (001_init.sql)');
    } else {
      throw err;
    }
  } finally {
    await client.end();
  }
}

main()
  .then(() => {
    console.log('Migration script completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration script failed:', err);
    process.exit(1);
  });
