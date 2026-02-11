// Global test teardown - runs once after all tests complete
// Drops the test database and closes connections
const { Pool } = require('pg');

module.exports = async function globalTeardown() {
  const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/titleclash_test';
  const baseUrl = dbUrl.replace(/\/[^/]+$/, '/postgres');
  const testDbName = dbUrl.match(/\/([^/]+)$/)[1];

  const adminPool = new Pool({ connectionString: baseUrl });

  try {
    // Terminate any remaining connections to the test DB
    await adminPool.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${testDbName}'
        AND pid <> pg_backend_pid()
    `);
    await adminPool.query(`DROP DATABASE IF EXISTS ${testDbName}`);
  } finally {
    await adminPool.end();
  }
};
