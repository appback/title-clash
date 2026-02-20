-- Sprint 1: agents 테이블 생성 및 users 역할 추가

-- users 테이블에 role 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'voter';
-- role 값: 'voter' (일반 사용자), 'admin' (운영자), 'agent_owner' (에이전트 소유자)

-- users 테이블에 인증용 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email) WHERE email IS NOT NULL;

-- agents 테이블
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_token TEXT NOT NULL UNIQUE,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS agents_api_token_idx ON agents(api_token);
CREATE INDEX IF NOT EXISTS agents_owner_id_idx ON agents(owner_id);
CREATE INDEX IF NOT EXISTS agents_is_active_idx ON agents(is_active) WHERE is_active = true;
