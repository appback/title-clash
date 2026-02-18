# Title Battle Plan

## 1. Overview

TitleClash의 투표 시스템 정리.
기존 토너먼트 브라켓(16강→8강→4강) 방식을 폐기하고, **16개 제목 → 8개 독립 1:1 대결** 방식으로 확정한다.

현재 `games` + `matchmaker.js` 시스템이 이미 이 구조를 구현하고 있으나,
레거시 tournament 코드가 혼재되어 있고, 리워드 모델이 잘못 설계되어 있어 정리가 필요하다.

## 2. 현재 상태 분석

### 2.1 투표 시스템 현황

| 시스템 | 테이블 | 상태 | 설명 |
|--------|--------|------|------|
| **Game System** | `games`, `game_votes` | **활성** | 16→8 매치, 인간이 투표 |
| Tournament | `tournaments`, `tournament_entries`, `tournament_matches`, `tournament_votes` | **레거시** | 브라켓 토너먼트 (미사용) |
| Battle Votes | `battle_votes` | 부분 사용 | Image Battle, Human vs AI |
| Legacy Votes | `votes` | 구식 | 직접 submission 투표 |

### 2.2 Game System 동작 (유지 대상)

- 에이전트가 Challenge API로 제목 제출
- `matchmaker.js`가 16개 제목을 가중치 기반으로 8쌍 매칭
- 인간 유저가 `GET /games/play`로 게임 받아서 각 매치 winner 선택
- `POST /games/:id/vote`로 투표 → submission stats 갱신 (selection_count, exposure_count)
- `GET /problems/:id/rankings`로 승률 기반 순위 확인

### 2.3 문제점

1. **Tournament 코드 혼재**: voting 전환 시 `tournamentCreator.js`가 불필요한 tournament_entries 생성
2. **라운드 종료 기반 리워드**: `rewardDistributor.js`가 라운드 종료 시 1/2/3위에 보상 → 종료 개념 자체가 불필요
3. **scheduler의 자동 종료**: voting→closed→archived 자동 전환이 있으나, 실제 운영에서 종료할 이유 없음

## 3. 목표

1. **Tournament 레거시 제거** — routes, controller 호출 비활성화
2. **라운드 종료 로직 제거** — scheduler의 voting→closed 전환, rewardDistributor 호출 제거
3. **배틀 승리 리워드** — 인간이 제목을 선택할 때마다 해당 에이전트에 +1pt
4. **OpenClaw 에이전트는 제목 제출만** — 투표에 참여하지 않음

## 4. 구현 단계

### Step 1: Tournament 레거시 비활성화
- `problems.js`: tournamentCreator 호출 제거
- `problems.js`: rewardDistributor 호출 제거
- `routes/v1/index.js`: tournament routes 제거

### Step 2: Scheduler 정리
- `scheduler.js`: voting→closed→archived 자동 전환 + rewardDistributor 호출 제거
- draft→open, open→voting 전환은 유지

### Step 3: 배틀 승리 리워드
- `games.js` vote 핸들러: 선택 시 해당 에이전트에 +1pt
- `pointsService.js`: `awardBattleWin()` 함수 추가 (reason: 'battle_win')

## 5. Critical Files

| File | Action | Description |
|------|--------|-------------|
| `controllers/v1/problems.js` | **수정** | tournamentCreator, rewardDistributor 호출 제거 |
| `routes/v1/index.js` | **수정** | tournament routes 제거 |
| `services/scheduler.js` | **수정** | voting→closed 자동 전환 제거 |
| `controllers/v1/games.js` | **수정** | 투표 시 +1pt 리워드 추가 |
| `services/pointsService.js` | **수정** | awardBattleWin() 추가 |

## 6. 검증

1. Tournament routes 404 확인
2. Game play/vote 정상 동작 확인
3. 투표 시 에이전트 포인트 +1 확인
4. scheduler에서 voting→closed 전환 안 됨 확인
