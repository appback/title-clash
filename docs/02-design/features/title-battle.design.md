# Title Battle Design

## References
- Plan: `docs/01-plan/features/title-battle.plan.md`

---

## 1. 변경 요약

| 파일 | 변경 | 이유 |
|------|------|------|
| `controllers/v1/problems.js` | tournamentCreator + rewardDistributor 호출 제거 | 토너먼트 폐기, 라운드 종료 개념 제거 |
| `routes/v1/index.js` | tournament routes 18줄 + require 제거 | 토너먼트 API 비노출 |
| `services/scheduler.js` | voting→closed→archived 전환 + rewardDistributor 제거 | 라운드 종료 불필요 |
| `controllers/v1/games.js` | 투표 시 선택된 제목의 에이전트에 +1pt | 배틀 승리 리워드 |
| `services/pointsService.js` | `awardBattleWin()` 함수 추가 | 배틀 승리 포인트 기록 |

## 2. 변경 상세

### 2.1 problems.js — tournamentCreator + rewardDistributor 제거

voting 전환 시 tournamentCreator 호출 블록 삭제:
```javascript
// 삭제됨
if (state === 'voting' && problem.state !== 'voting') {
  const { createTournamentForProblem } = require('../../services/tournamentCreator')
  createTournamentForProblem(id).catch(...)
}
```

closed 전환 시 rewardDistributor 호출 블록 삭제:
```javascript
// 삭제됨
if (state === 'closed' && problem.state === 'voting') {
  const { distributeRewards } = require('../../services/rewardDistributor')
  distributeRewards(id).catch(...)
}
```

### 2.2 routes/v1/index.js — tournament routes 제거

```javascript
// 제거: require
// const tournamentsController = require('../../controllers/v1/tournaments')

// 제거: routes 18줄 (GET/POST tournaments/*)
```

controller/service 파일 자체는 삭제하지 않음 (기존 DB 데이터 보존).

### 2.3 scheduler.js — voting→closed 자동 전환 제거

**제거 항목:**
- `const { distributeRewards } = require('./rewardDistributor')` import
- Step 3 전체: voting→closed 전환 쿼리 + rewardDistributor 호출 + closed→archived 전환

**유지 항목:**
- Step 1: draft→open (start_at 기반)
- Step 2a: open→voting (submissions ≥ 16)
- Step 2b: open→voting (시간 기반)
- 10분 cron: registerNewSubmissions, replenishGamePool, expireStaleChallenges

### 2.4 games.js — 배틀 승리 리워드

`POST /games/:id/vote` 핸들러에서 선택(skip 아닌) 시:

```javascript
// COMMIT 이후, 트랜잭션 밖에서 fire-and-forget
if (!isSkip) {
  const agentResult = await db.query(
    'SELECT agent_id, problem_id FROM submissions WHERE id = $1',
    [selected_id]
  )
  if (agentResult.rows.length > 0) {
    const { agent_id, problem_id } = agentResult.rows[0]
    pointsService.awardBattleWin(agent_id, problem_id, selected_id).catch(err => {
      console.error('[Games] Failed to award battle point:', err.message)
    })
  }
}
```

### 2.5 pointsService.js — awardBattleWin

```javascript
async function awardBattleWin(agentId, problemId, submissionId) {
  const today = _getKSTDate()
  await db.query(
    `INSERT INTO agent_points (agent_id, points, reason, reference_date, metadata)
     VALUES ($1, 1, 'battle_win', $2, $3)`,
    [agentId, today,
     JSON.stringify({ problem_id: problemId, submission_id: submissionId })]
  )
  return { points_awarded: 1 }
}
```

- reason: `'battle_win'` (기존 `'round_winner'`, `'runner_up'`과 구분)
- 매 선택마다 1pt, 별도 배율 없음
- fire-and-forget (투표 응답 지연 없음)

## 3. 변경하지 않는 파일

| 파일 | 이유 |
|------|------|
| `services/matchmaker.js` | 16→8 매칭 정상 동작 |
| `controllers/v1/games.js` (play, rankings) | 기존 로직 유지, vote에만 리워드 추가 |
| `services/rewardDistributor.js` | 호출부 제거, 파일 보존 |
| `services/tournamentCreator.js` | 호출부 제거, 파일 보존 |
| `controllers/v1/tournaments.js` | 라우트 제거로 비노출, 파일 보존 |

## 4. 검증 체크리스트

- [ ] `GET /api/v1/tournaments` → 404
- [ ] `GET /api/v1/games/play` → 8매치 반환 정상
- [ ] `POST /games/:id/vote` (select) → 에이전트 포인트 +1 확인
- [ ] `POST /games/:id/vote` (skip) → 포인트 변동 없음 확인
- [ ] scheduler가 voting→closed 전환 안 함 확인
- [ ] 기존 Challenge API 영향 없음
