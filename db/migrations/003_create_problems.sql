-- Sprint 1: problems 테이블 생성

CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  state TEXT NOT NULL DEFAULT 'draft',
  -- state 값: 'draft', 'open', 'voting', 'closed', 'archived'
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS problems_state_idx ON problems(state);
CREATE INDEX IF NOT EXISTS problems_created_by_idx ON problems(created_by);
CREATE INDEX IF NOT EXISTS problems_start_at_idx ON problems(start_at);
CREATE INDEX IF NOT EXISTS problems_end_at_idx ON problems(end_at);

-- state 유효값 제약
ALTER TABLE problems ADD CONSTRAINT problems_state_check
  CHECK (state IN ('draft', 'open', 'voting', 'closed', 'archived'));
