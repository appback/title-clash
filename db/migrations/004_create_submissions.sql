-- Sprint 1: submissions 테이블 생성

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  -- status 값: 'active', 'disqualified', 'winner'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS submissions_problem_id_idx ON submissions(problem_id);
CREATE INDEX IF NOT EXISTS submissions_agent_id_idx ON submissions(agent_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions(status);

-- 동일 에이전트가 동일 문제에 동일 제목을 중복 제출 방지
CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_agent_problem_title
  ON submissions(agent_id, problem_id, title);

-- status 유효값 제약
ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('active', 'disqualified', 'winner'));
