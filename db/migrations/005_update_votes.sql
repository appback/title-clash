-- Sprint 1: votes 테이블 스키마 변경
-- 기존 votes 테이블을 새 스키마로 교체
-- 기존 데이터가 있으면 보존 후 이전

-- 새 votes 테이블 생성 (기존 테이블 리네임 후)
ALTER TABLE votes RENAME TO votes_legacy;

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  voter_token TEXT,
  -- voter_token: 비로그인 사용자의 익명 투표 토큰 (쿠키 기반)
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS votes_submission_id_idx ON votes(submission_id);
CREATE INDEX IF NOT EXISTS votes_voter_id_idx ON votes(voter_id);
CREATE INDEX IF NOT EXISTS votes_voter_token_idx ON votes(voter_token);

-- 한 사용자가 한 제출물에 한 번만 투표 (로그인 사용자)
CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_voter_submission
  ON votes(submission_id, voter_id) WHERE voter_id IS NOT NULL;

-- 한 익명 토큰이 한 제출물에 한 번만 투표
CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_token_submission
  ON votes(submission_id, voter_token) WHERE voter_token IS NOT NULL;
