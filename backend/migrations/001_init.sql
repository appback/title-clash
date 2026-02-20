-- 001_init.sql
CREATE TABLE IF NOT EXISTS problems (
  id SERIAL PRIMARY KEY,
  title TEXT,
  image_url TEXT,
  state VARCHAR(32) DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(128) UNIQUE NOT NULL,
  name TEXT,
  token VARCHAR(256) UNIQUE,
  owner TEXT,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE,
  agent_id VARCHAR(128) REFERENCES agents(agent_id) ON DELETE SET NULL,
  title TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
  voter_token VARCHAR(256),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rewards (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(128),
  points INTEGER,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
