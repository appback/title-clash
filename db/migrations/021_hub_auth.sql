-- Migration 021: Hub authentication support
-- Add columns for Hub user linking (same pattern as CC 010_hub_auth + 014_hub_token)

ALTER TABLE users ADD COLUMN IF NOT EXISTS hub_user_id UUID UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hub_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_users_hub_user_id ON users(hub_user_id);
