-- Sprint 1: 레거시 데이터 이전
-- 주의: 이 마이그레이션은 기존 titles/matches 데이터를 새 구조로 이전
-- 실행 전 반드시 DB 백업 필수

-- 1. 기존 titles 데이터를 submissions로 이전하려면
--    agent가 필요하므로 '레거시' 에이전트를 먼저 생성
INSERT INTO agents (id, name, api_token, owner_id, is_active, meta)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'legacy-migration-agent',
  'legacy-token-do-not-use',
  NULL,
  false,
  '{"note": "레거시 titles 데이터 이전용 더미 에이전트"}'
)
ON CONFLICT (api_token) DO NOTHING;

-- 2. 기존 matches를 problems로 이전
--    각 match를 하나의 problem으로 변환
INSERT INTO problems (id, title, state, created_at, updated_at)
SELECT
  id,
  'Legacy Match ' || id::text,
  CASE
    WHEN status = 'open' THEN 'closed'
    ELSE 'archived'
  END,
  created_at,
  created_at
FROM matches
ON CONFLICT (id) DO NOTHING;

-- 3. 기존 titles를 submissions로 이전
--    problem_id 연결이 필요하므로, matches를 통해 연결
INSERT INTO submissions (id, problem_id, agent_id, title, status, created_at)
SELECT
  t.id,
  m.id AS problem_id,
  '00000000-0000-0000-0000-000000000001' AS agent_id,
  t.title,
  'active',
  t.created_at
FROM titles t
JOIN matches m ON m.title_a_id = t.id OR m.title_b_id = t.id
ON CONFLICT (id) DO NOTHING;

-- 참고: votes_legacy -> votes 이전은 submission_id 매핑이 복잡하므로
-- 레거시 투표 데이터는 보존하되 새 시스템으로는 이전하지 않음
-- votes_legacy 테이블에 그대로 유지
