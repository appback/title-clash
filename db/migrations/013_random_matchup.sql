-- 013_random_matchup.sql
-- Transition from bracket tournament to random matchup system.
-- tournament_votes.match_id becomes nullable (votes no longer tied to matches).
-- Drop unique indexes on match_id and recreate for the new model.

-- 1. Make match_id nullable and drop FK constraint
ALTER TABLE tournament_votes ALTER COLUMN match_id DROP NOT NULL;
ALTER TABLE tournament_votes DROP CONSTRAINT IF EXISTS tournament_votes_match_id_fkey;

-- 2. Drop old unique indexes that required match_id
DROP INDEX IF EXISTS idx_tvote_match_user;
DROP INDEX IF EXISTS idx_tvote_match_token;

-- 3. Create new indexes for the vote model (entry-based)
CREATE INDEX IF NOT EXISTS idx_tvote_entry ON tournament_votes(entry_id);
CREATE INDEX IF NOT EXISTS idx_tvote_voter ON tournament_votes(voter_id) WHERE voter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tvote_token ON tournament_votes(voter_token) WHERE voter_token IS NOT NULL;

-- 4. Clean up old tournament_matches data (optional, data no longer used)
-- TRUNCATE tournament_matches;
-- Leaving data in place; it's harmless. Uncomment above if you want to clean up.
