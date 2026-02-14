-- 014_battle_votes.sql
-- Votes for Image Battle (mode 2) and Human vs AI (mode 3) battle modes

CREATE TABLE IF NOT EXISTS battle_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL,               -- 'image_battle' or 'human_vs_ai'
  winner_id UUID NOT NULL,          -- submission_id or human_submission_id
  winner_type TEXT NOT NULL,         -- 'ai' or 'human'
  loser_id UUID NOT NULL,
  loser_type TEXT NOT NULL,
  voter_id UUID REFERENCES users(id),
  voter_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bvote_mode ON battle_votes(mode);
CREATE INDEX IF NOT EXISTS idx_bvote_winner ON battle_votes(winner_id);
