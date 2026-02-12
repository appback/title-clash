-- 011_human_submissions.sql
-- Human participation: submit titles and like them

CREATE TABLE IF NOT EXISTS human_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_token TEXT,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tournament_id, user_id),
  UNIQUE(tournament_id, user_token)
);

CREATE INDEX IF NOT EXISTS idx_hsub_tournament ON human_submissions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_hsub_likes ON human_submissions(tournament_id, like_count DESC);

CREATE TABLE IF NOT EXISTS human_submission_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  human_submission_id UUID NOT NULL REFERENCES human_submissions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hslike_user
  ON human_submission_likes(human_submission_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hslike_token
  ON human_submission_likes(human_submission_id, user_token) WHERE user_token IS NOT NULL;
