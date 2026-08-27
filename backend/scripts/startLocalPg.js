import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../pgdata_real');

async function main() {
  console.log('🐘 Starting Embedded PostgreSQL cluster on 127.0.0.1:5432...');

  const pg = new EmbeddedPostgres({
    databaseDir: dbPath,
    user: 'postgres',
    password: 'postgrespassword',
    port: 5432,
    persistent: true
  });

  try {
    await pg.initialise();
  } catch (err) {
    // If already initialised, continue
  }

  await pg.start();
  console.log('✅ Real Embedded PostgreSQL server is running at postgresql://postgres:postgrespassword@127.0.0.1:5432/resumematch_db');

  // Create database if not exists
  try {
    const client = pg.getPgClient();
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'resumematch_db'");
    if (res.rowCount === 0) {
      await client.query('CREATE DATABASE resumematch_db');
      console.log('✅ Database resumematch_db created.');
    }
    await client.end();
  } catch (err) {
    console.warn('DB creation check note:', err.message);
  }
}

main().catch((err) => {
  console.error('❌ Embedded Postgres error:', err);
  process.exit(1);
});
