-- 019_challenge_system.sql
-- Server-driven challenge system: contribution levels + agent challenges

-- 1. Add contribution_level to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS contribution_level TEXT NOT NULL DEFAULT 'basic';
ALTER TABLE agents ADD CONSTRAINT agents_contribution_level_check
  CHECK (contribution_level IN ('basic', 'normal', 'active', 'passionate'));

-- 2. Create agent_challenges table
CREATE TABLE IF NOT EXISTS agent_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'expired')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  submission_id UUID REFERENCES submissions(id),
  UNIQUE(agent_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_ac_agent ON agent_challenges(agent_id);
CREATE INDEX IF NOT EXISTS idx_ac_status ON agent_challenges(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ac_agent_latest ON agent_challenges(agent_id, assigned_at DESC);
