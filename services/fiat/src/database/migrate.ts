import { Client } from 'pg';
import { databaseConnection } from './connection';
import { createDatabaseSource } from './data-source';

export async function migrateDatabase() {
  const connection = databaseConnection();
  const databaseSource = createDatabaseSource(connection);
  const client = new Client('url' in connection ? { connectionString: connection.url, ssl: connection.ssl } : {
    host: connection.host, port: connection.port, user: connection.username, password: connection.password, database: connection.database, ssl: connection.ssl,
  });
  await client.connect();
  try { await client.query('CREATE SCHEMA IF NOT EXISTS fiat'); } finally { await client.end(); }
  await databaseSource.initialize();
  try { await databaseSource.runMigrations({ transaction: 'all' }); } finally { await databaseSource.destroy(); }
}
if (require.main === module) migrateDatabase().catch(() => { console.error('Database migration failed. Inspect the schema before retrying.'); process.exitCode = 1; });
