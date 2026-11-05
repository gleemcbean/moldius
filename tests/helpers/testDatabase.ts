import { DataType, newDb } from 'pg-mem';
import { createDatabase, databaseFromPool, type Database } from '../../server/accounts/database.js';

export const usesRealPostgres = Boolean(process.env.TEST_DATABASE_URL);

export async function createTestDatabase(): Promise<Database> {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const database = createDatabase({ connectionString: url, ssl: false, maxConnections: 4 });
    await database.query(
      'DROP TABLE IF EXISTS password_resets, pending_registrations, match_history, auth_sessions, accounts, schema_migrations CASCADE',
    );
    return database;
  }
  const memory = newDb();
  memory.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [DataType.bigint],
    returns: DataType.text,
    implementation: () => '',
    impure: true,
  });
  memory.public.registerFunction({
    name: 'char_length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (value: string) => [...value].length,
  });
  memory.public.registerFunction({
    name: 'greatest',
    args: [DataType.integer, DataType.integer],
    returns: DataType.integer,
    implementation: (a: number, b: number) => Math.max(a, b),
  });
  const { Pool } = memory.adapters.createPg();
  return databaseFromPool(new Pool());
}
