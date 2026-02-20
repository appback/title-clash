-- 016_game_system.sql
-- Game system: replaces tournament layer with direct submission-based matching

-- Pre-generated games (replaces tournaments for voting)
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES problems(id),
  matches JSONB NOT NULL,       -- [{a: sub_id, b: sub_id}, ...]
  play_count INTEGER DEFAULT 0, -- times served to voters
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_games_problem ON games(problem_id);
CREATE INDEX IF NOT EXISTS idx_games_play_count ON games(play_count ASC);

-- Game vote records
CREATE TABLE IF NOT EXISTS game_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  match_index SMALLINT NOT NULL,
  selected_id UUID REFERENCES submissions(id),
  shown_a_id UUID NOT NULL REFERENCES submissions(id),
  shown_b_id UUID NOT NULL REFERENCES submissions(id),
  action TEXT NOT NULL DEFAULT 'select',  -- 'select' | 'skip'
  voter_id UUID REFERENCES users(id),
  voter_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gv_game ON game_votes(game_id);
CREATE INDEX IF NOT EXISTS idx_gv_selected ON game_votes(selected_id);

-- Add stat columns to submissions
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS exposure_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selection_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skip_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ;

-- Existing active submissions: register immediately
UPDATE submissions SET registered_at = created_at
WHERE status = 'active' AND registered_at IS NULL;

-- Index for matchmaker queries
CREATE INDEX IF NOT EXISTS idx_sub_registered ON submissions(registered_at)
  WHERE registered_at IS NOT NULL AND status = 'active';
