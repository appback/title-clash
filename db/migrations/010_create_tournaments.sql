-- 010_create_tournaments.sql
-- Tournament system: brackets, matches, votes for Title Battle (Content 1)

-- 1. tournaments 테이블
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'title_battle',
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'draft',
  total_rounds INTEGER NOT NULL DEFAULT 4,
  current_round INTEGER NOT NULL DEFAULT 0,
  human_submissions_open BOOLEAN DEFAULT false,
  participant_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_type ON tournaments(content_type);
CREATE INDEX IF NOT EXISTS idx_tournament_phase ON tournaments(phase);
CREATE INDEX IF NOT EXISTS idx_tournament_problem ON tournaments(problem_id);

-- 2. tournament_entries 테이블
CREATE TABLE IF NOT EXISTS tournament_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'ai',
  title TEXT NOT NULL,
  image_url TEXT,
  author_name TEXT NOT NULL,
  model_name TEXT,
  seed INTEGER,
  is_eliminated BOOLEAN DEFAULT false,
  final_rank INTEGER,
  total_votes_received INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tent_tournament ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tent_source ON tournament_entries(source);
CREATE INDEX IF NOT EXISTS idx_tent_rank ON tournament_entries(tournament_id, final_rank);

-- 3. tournament_matches 테이블
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round TEXT NOT NULL,
  match_order INTEGER NOT NULL,
  entry_a_id UUID REFERENCES tournament_entries(id),
  entry_b_id UUID REFERENCES tournament_entries(id),
  winner_id UUID REFERENCES tournament_entries(id),
  vote_count_a INTEGER DEFAULT 0,
  vote_count_b INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  next_match_id UUID REFERENCES tournament_matches(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tmatch_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tmatch_status ON tournament_matches(status);
CREATE INDEX IF NOT EXISTS idx_tmatch_round ON tournament_matches(tournament_id, round);

-- 4. tournament_votes 테이블
CREATE TABLE IF NOT EXISTS tournament_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES tournament_entries(id),
  voter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  voter_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tvote_match_user
  ON tournament_votes(match_id, voter_id) WHERE voter_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tvote_match_token
  ON tournament_votes(match_id, voter_token) WHERE voter_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tvote_match ON tournament_votes(match_id);
