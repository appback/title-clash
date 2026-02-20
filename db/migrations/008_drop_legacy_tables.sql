-- Sprint 1 (최종): 레거시 테이블 제거
-- 주의: 이 마이그레이션은 되돌릴 수 없음. 반드시 007 이후 데이터 확인 후 실행

-- 레거시 테이블 DROP
DROP TABLE IF EXISTS votes_legacy CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS titles CASCADE;
