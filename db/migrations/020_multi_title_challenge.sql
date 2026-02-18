-- 020_multi_title_challenge.sql
-- Allow same problem re-assignment after expiry (multi-title challenge support)

-- Drop UNIQUE(agent_id, problem_id) so expired challenges can be re-assigned
ALTER TABLE agent_challenges DROP CONSTRAINT IF EXISTS agent_challenges_agent_id_problem_id_key;
