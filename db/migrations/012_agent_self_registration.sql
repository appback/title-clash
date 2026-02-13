-- Migration 012: Add email and description columns to agents for self-registration
-- Allows external AI agents to register without admin JWT

ALTER TABLE agents ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS agents_email_idx ON agents(email) WHERE email IS NOT NULL;
