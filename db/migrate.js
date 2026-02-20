// Database migration runner for TitleClash
// Usage:
//   node db/migrate.js up      - Run all pending migrations
//   node db/migrate.js status  - Show migration status

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Create a pg pool - reuse the same connection string logic as apps/api/db/index.js
function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL
      || process.env.TITLECLASH_DATABASE_URL
      || 'postgres://postgres:postgres@localhost:5432/titleclash'
  });
}

/**
 * Ensure the schema_migrations tracking table exists.
 */
async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);
}

/**
 * Get list of already-executed migration filenames.
 */
async function getExecutedMigrations(pool) {
  const result = await pool.query(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  return result.rows.map(row => row.filename);
}

/**
 * Get all .sql migration files sorted alphabetically.
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('Migrations directory not found:', MIGRATIONS_DIR);
    process.exit(1);
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

/**
 * Run all pending migrations.
 */
async function runUp(pool) {
  await ensureMigrationsTable(pool);

  const executed = await getExecutedMigrations(pool);
  const allFiles = getMigrationFiles();
  const pending = allFiles.filter(f => !executed.includes(f));

  if (pending.length === 0) {
    console.log('All migrations are up to date. Nothing to run.');
    return;
  }

  console.log(`Found ${pending.length} pending migration(s):\n`);

  for (const filename of pending) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`  Running: ${filename} ...`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [filename]
      );
      await client.query('COMMIT');
      console.log(`  Done:    ${filename}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`\n  FAILED:  ${filename}`);
      console.error(`  Error:   ${err.message}`);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log(`\nAll ${pending.length} migration(s) completed successfully.`);
}

/**
 * Show status of all migrations.
 */
async function showStatus(pool) {
  await ensureMigrationsTable(pool);

  const executed = await getExecutedMigrations(pool);
  const allFiles = getMigrationFiles();

  // Get executed_at timestamps
  const result = await pool.query(
    'SELECT filename, executed_at FROM schema_migrations ORDER BY filename'
  );
  const executedMap = {};
  for (const row of result.rows) {
    executedMap[row.filename] = row.executed_at;
  }

  console.log('Migration Status:\n');
  console.log('  Status     | Executed At              | Filename');
  console.log('  -----------+--------------------------+----------------------------');

  for (const filename of allFiles) {
    if (executed.includes(filename)) {
      const at = new Date(executedMap[filename]).toISOString();
      console.log(`  DONE       | ${at} | ${filename}`);
    } else {
      console.log(`  PENDING    |                          | ${filename}`);
    }
  }

  const pendingCount = allFiles.length - executed.length;
  console.log(`\n  Total: ${allFiles.length} | Executed: ${executed.length} | Pending: ${pendingCount}`);
}

/**
 * Main entry point.
 */
async function main() {
  const command = process.argv[2];

  if (!command || !['up', 'status'].includes(command)) {
    console.log('Usage: node db/migrate.js <command>');
    console.log('');
    console.log('Commands:');
    console.log('  up      Run all pending migrations');
    console.log('  status  Show migration status');
    process.exit(1);
  }

  const pool = createPool();

  try {
    if (command === 'up') {
      await runUp(pool);
    } else if (command === 'status') {
      await showStatus(pool);
    }
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
