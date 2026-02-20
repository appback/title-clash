-- 018_agent_points.sql
-- Agent Points System + Title Rating

-- ============================================
-- 1. 포인트 이력 테이블 (단일 포인트 소스)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ap_agent ON agent_points(agent_id);
CREATE INDEX IF NOT EXISTS idx_ap_date ON agent_points(reference_date);
CREATE INDEX IF NOT EXISTS idx_ap_agent_date ON agent_points(agent_id, reference_date);
CREATE INDEX IF NOT EXISTS idx_ap_reason ON agent_points(reason);

-- ============================================
-- 2. 일일 참여 요약 (캐시/집계)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_daily_summary (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  reference_date DATE NOT NULL,
  submission_count INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  milestones_hit TEXT[] DEFAULT '{}',
  PRIMARY KEY (agent_id, reference_date)
);

-- ============================================
-- 3. 타이틀 평가 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS title_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars >= 0 AND stars <= 5),
  voter_id UUID REFERENCES users(id),
  voter_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tr_voter_unique
  ON title_ratings(submission_id, COALESCE(voter_id::text, ''), COALESCE(voter_token, ''));
CREATE INDEX IF NOT EXISTS idx_tr_submission ON title_ratings(submission_id);

-- ============================================
-- 4. submissions에 평가 캐시 컬럼 추가
-- ============================================
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- ============================================
-- 5. 기존 rewards → agent_points 마이그레이션
-- ============================================
INSERT INTO agent_points (agent_id, points, reason, reference_date, metadata, created_at)
SELECT
  r.agent_id,
  r.points,
  r.reason,
  DATE(r.issued_at AT TIME ZONE 'Asia/Seoul'),
  jsonb_build_object('problem_id', r.problem_id, 'migrated_from', 'rewards'),
  r.issued_at
FROM rewards r
WHERE NOT EXISTS (
  SELECT 1 FROM agent_points ap
  WHERE ap.agent_id = r.agent_id
    AND ap.reason = r.reason
    AND ap.metadata->>'migrated_from' = 'rewards'
    AND ap.metadata->>'problem_id' = r.problem_id::text
);

-- ============================================
-- 6. 기존 활성 에이전트 등록 보너스 소급
-- ============================================
INSERT INTO agent_points (agent_id, points, reason, reference_date, metadata, created_at)
SELECT
  a.id,
  1000,
  'registration',
  DATE(a.created_at AT TIME ZONE 'Asia/Seoul'),
  '{"migrated": true}'::jsonb,
  a.created_at
FROM agents a
WHERE a.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM agent_points ap
    WHERE ap.agent_id = a.id AND ap.reason = 'registration'
  );
