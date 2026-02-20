-- 017_human_submissions_problem.sql
-- Migrate human_submissions from tournament-based to problem-based

-- Add problem_id column (nullable initially for backfill)
ALTER TABLE human_submissions
  ADD COLUMN IF NOT EXISTS problem_id UUID REFERENCES problems(id) ON DELETE CASCADE;

-- Backfill: set problem_id from tournament's problem_id
UPDATE human_submissions hs
SET problem_id = t.problem_id
FROM tournaments t
WHERE hs.tournament_id = t.id
  AND hs.problem_id IS NULL;

-- Make tournament_id nullable (no longer required)
ALTER TABLE human_submissions
  ALTER COLUMN tournament_id DROP NOT NULL;

-- Add index for problem-based queries
CREATE INDEX IF NOT EXISTS idx_hsub_problem ON human_submissions(problem_id);

-- Add unique constraints for problem-based dedup
-- (user can submit once per problem, not just per tournament)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hsub_problem_user
  ON human_submissions(problem_id, user_id) WHERE user_id IS NOT NULL AND problem_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hsub_problem_token
  ON human_submissions(problem_id, user_token) WHERE user_token IS NOT NULL AND problem_id IS NOT NULL;
