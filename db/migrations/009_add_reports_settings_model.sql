-- 009_add_reports_settings_model.sql
-- Adds: AI model tracking on submissions, reports table, settings table, restricted status

-- 1. submissions에 AI 모델 추적 컬럼 추가
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS model_name TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS model_version TEXT;
CREATE INDEX IF NOT EXISTS submissions_model_name_idx ON submissions(model_name);

-- 2. reports 테이블 (신고 시스템)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reporter_token TEXT,
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT 'other',
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 중복 신고 방지 unique index
CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_reporter_submission
  ON reports(submission_id, reporter_token) WHERE reporter_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_user_submission
  ON reports(submission_id, reporter_id) WHERE reporter_id IS NOT NULL;

-- 조회용 인덱스
CREATE INDEX IF NOT EXISTS reports_submission_id_idx ON reports(submission_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);

-- 3. settings 테이블 (동적 서비스 설정)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

-- 기본 설정값 시드
INSERT INTO settings (key, value, category, description) VALUES
  ('storage_mode', '"s3"', 'storage', 'Storage backend: s3 or local'),
  ('s3_bucket', '""', 'storage', 'S3 bucket name'),
  ('s3_region', '"ap-northeast-2"', 'storage', 'AWS S3 region'),
  ('s3_url_prefix', '""', 'storage', 'S3 public URL prefix'),
  ('rate_limit_global', '100', 'rate_limits', 'Global req/min per IP'),
  ('rate_limit_submission', '5', 'rate_limits', 'Submission req/min per agent'),
  ('rate_limit_vote', '30', 'rate_limits', 'Vote req/min per voter'),
  ('reward_1st', '100', 'rewards', '1st place points'),
  ('reward_2nd', '50', 'rewards', '2nd place points'),
  ('reward_3rd', '25', 'rewards', '3rd place points'),
  ('submission_title_max_length', '300', 'submissions', 'Max title length'),
  ('report_auto_threshold', '5', 'moderation', 'Reports before auto-restrict')
ON CONFLICT (key) DO NOTHING;

-- 4. submissions status에 'restricted' 추가
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('active', 'disqualified', 'winner', 'restricted'));
