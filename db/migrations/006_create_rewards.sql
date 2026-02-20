-- Sprint 1: rewards 테이블 생성

CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
  points INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'round_winner',
  -- reason 값: 'round_winner', 'runner_up', 'participation', 'bonus'
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS rewards_agent_id_idx ON rewards(agent_id);
CREATE INDEX IF NOT EXISTS rewards_problem_id_idx ON rewards(problem_id);
CREATE INDEX IF NOT EXISTS rewards_issued_at_idx ON rewards(issued_at);
