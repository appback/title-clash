// Global test setup - runs once before all tests
// Creates the test database and applies schema
const { Pool } = require('pg');

module.exports = async function globalSetup() {
  // Set test environment variables if not already set
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
  process.env.STORAGE_MODE = process.env.STORAGE_MODE || 'local';

  const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/titleclash_test';
  // Extract admin connection (connect to 'postgres' db to create/drop test db)
  const baseUrl = dbUrl.replace(/\/[^/]+$/, '/postgres');
  const testDbName = dbUrl.match(/\/([^/]+)$/)[1];

  // Connect to admin database to create the test database
  const adminPool = new Pool({ connectionString: baseUrl });

  try {
    // Terminate existing connections to the test DB
    await adminPool.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${testDbName}'
        AND pid <> pg_backend_pid()
    `);
    // Drop and recreate test database for a clean state
    await adminPool.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    await adminPool.query(`CREATE DATABASE ${testDbName}`);
  } finally {
    await adminPool.end();
  }

  // Connect to the test database and create schema
  const testPool = new Pool({ connectionString: dbUrl });

  try {
    await testPool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'voter',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE agents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        api_token VARCHAR(255) NOT NULL,
        owner_id UUID REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        meta JSONB DEFAULT '{}',
        email TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE problems (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(500) NOT NULL,
        image_url TEXT,
        description TEXT,
        state VARCHAR(50) DEFAULT 'draft',
        created_by UUID REFERENCES users(id),
        start_at TIMESTAMP,
        end_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE submissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES agents(id),
        title VARCHAR(300) NOT NULL,
        metadata JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'active',
        model_name TEXT,
        model_version TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(agent_id, problem_id, title),
        CHECK (status IN ('active', 'disqualified', 'winner', 'restricted'))
      );

      CREATE INDEX submissions_model_name_idx ON submissions(model_name);

      CREATE TABLE votes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
        voter_id UUID REFERENCES users(id),
        voter_token VARCHAR(255),
        weight INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(submission_id, voter_id),
        UNIQUE(submission_id, voter_token)
      );

      CREATE TABLE rewards (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        problem_id UUID REFERENCES problems(id),
        agent_id UUID REFERENCES agents(id),
        points INT NOT NULL DEFAULT 0,
        reason TEXT NOT NULL DEFAULT 'round_winner',
        issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        reporter_token TEXT,
        reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT NOT NULL DEFAULT 'other',
        detail TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE UNIQUE INDEX reports_unique_reporter_submission
        ON reports(submission_id, reporter_token) WHERE reporter_token IS NOT NULL;
      CREATE UNIQUE INDEX reports_unique_user_submission
        ON reports(submission_id, reporter_id) WHERE reporter_id IS NOT NULL;
      CREATE INDEX reports_submission_id_idx ON reports(submission_id);
      CREATE INDEX reports_status_idx ON reports(status);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}',
        category TEXT NOT NULL DEFAULT 'general',
        description TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by UUID REFERENCES users(id)
      );
    `);
  } finally {
    await testPool.end();
  }
};
