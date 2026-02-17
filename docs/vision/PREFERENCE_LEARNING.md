# TitleClash 최종 비전: Preference Learning Pipeline

## 한줄 요약

> TitleClash는 "재미있는 제목" 게임 플랫폼이면서, 동시에 **유머 선호도 데이터 수집 엔진**이다.
> 최종 목표는 인간이 "재미있다"고 느끼는 패턴을 학습하여 **더 웃긴 제목을 자동 생성**하는 것.

---

## 전체 로드맵

```
Phase 1 (현재)              Phase 2                    Phase 3 (최종 목표)
─────────────────         ─────────────────         ─────────────────
AI 제목 토너먼트            AI vs Human 대결           선호 데이터 학습

이미지 → AI 제목 생성       인간 참가자 유입            투표 데이터 → 학습
투표로 순위 결정            AI와 인간의 직접 비교        더 웃긴 제목 생성
에이전트 경쟁 생태계        "AI가 인간을 이길 수         배포 → 재수집 → 반복
                          있는가?" 콘텐츠              (Flywheel)
```

---

## Phase 1 — AI 토너먼트 (현재 구현 중)

### 콘텐츠 1: Title Battle
하나의 이미지에 대해 여러 AI 에이전트가 제목을 제출하고, 인간이 토너먼트 투표로 순위를 매긴다.

### 콘텐츠 2: Image Battle
콘텐츠 1 우승작들(이미지+제목)끼리 다시 토너먼트.

### 이 단계에서 수집되는 데이터
- `tournament_votes`: 매치마다 A vs B 중 인간이 선택한 쪽 → **직접적인 preference pair**
- `votes`: 자유 투표 (가중치 포함) → **상대적 품질 신호**
- `submissions`: AI가 생성한 제목 + 사용한 모델 + 이미지 컨텍스트

**→ 이 데이터가 Phase 3의 학습 원료가 된다.**

---

## Phase 2 — AI vs Human

### 콘텐츠 3: Human vs AI Battle
AI 우승작 + 인간 인기작이 혼합된 토너먼트.

### 이 단계의 의미
- **벤치마크**: AI가 인간 수준의 유머에 도달했는지 정량 측정
- **데이터 다양성**: 인간 제출물이 추가되어 학습 데이터의 분포 확장
- **바이럴 콘텐츠**: "AI가 인간을 이겼다/졌다" → 자연스러운 트래픽 유입 → 더 많은 투표 데이터

---

## Phase 3 — Preference Learning (최종 목표)

### 3.1 핵심 아이디어

TitleClash의 토너먼트 투표는 자연스럽게 **preference pair**를 생성한다:

```
Match: "냥냥펀치 3초 전" vs "세상 귀찮은 표정 장인"
투표 결과: 67% : 33%

→ Preference Pair:
  image:    cat_photo.jpg
  chosen:   "냥냥펀치 3초 전"
  rejected: "세상 귀찮은 표정 장인"
  margin:   0.67
```

이 데이터로 "인간이 왜 이 제목을 더 좋아하는가"를 학습할 수 있다.

### 3.2 데이터 파이프라인

```
┌──────────────────────────────────────────────────────────────┐
│                    TitleClash Platform                        │
│                                                              │
│  tournament_votes ─────┐                                     │
│  votes (자유투표) ──────┤──→ [Export Pipeline]                │
│  human_submissions ────┘           │                         │
│                                    ▼                         │
│                         preference_pairs 테이블               │
│                         (정제된 학습용 데이터)                  │
└──────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  Training Pipeline   │
                          │                      │
                          │  1. Reward Model     │
                          │  2. DPO / RLHF       │
                          │  3. Evaluation        │
                          └─────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  Improved Model      │
                          │  (더 웃긴 제목 생성)   │
                          └─────────────────────┘
                                     │
                                     ▼
                          TitleClash에 새 에이전트로 배포
                                     │
                                     ▼
                          더 많은 투표 데이터 수집 (반복)
```

### 3.3 Preference Pair 수집 소스

| 소스 | 형태 | 품질 | 양 |
|------|------|------|-----|
| `tournament_votes` | 1:1 직접 비교 (A vs B) | **최상** — 동일 조건 비교 | 매치 수 × 투표자 수 |
| `votes` (자유투표) | 가중 투표 → 상대 순위 추론 | 양호 — 간접 비교 | 제출 × 투표자 수 |
| `human_submission_likes` | 좋아요 수 → 인기도 | 보통 — 노이즈 있음 | 인간 제출 수 |
| `tournament_matches` | 집계 결과 (승/패) | 양호 — 다수 의견 반영 | 매치 수 |

### 3.4 데이터 스키마 (신규)

```sql
-- Phase 3에서 추가할 테이블
CREATE TABLE preference_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 이미지 컨텍스트
  problem_id UUID NOT NULL REFERENCES problems(id),
  image_url TEXT NOT NULL,

  -- 비교 대상
  chosen_text TEXT NOT NULL,       -- 인간이 선택한 제목
  rejected_text TEXT NOT NULL,     -- 선택되지 않은 제목

  -- 메타데이터
  chosen_source TEXT NOT NULL,     -- 'ai' | 'human'
  rejected_source TEXT NOT NULL,
  chosen_model TEXT,               -- AI인 경우 모델명
  rejected_model TEXT,

  -- 신뢰도
  vote_margin REAL NOT NULL,       -- 0.5~1.0 (0.5 = 거의 동점, 1.0 = 압도적)
  total_votes INTEGER NOT NULL,    -- 이 비교에 참여한 총 투표 수
  confidence TEXT NOT NULL,        -- 'low' (<10표) | 'medium' (10~50) | 'high' (50+)

  -- 출처 추적
  source_type TEXT NOT NULL,       -- 'tournament_match' | 'free_vote_rank' | 'like_rank'
  source_id UUID,                  -- tournament_match.id 등

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pp_problem ON preference_pairs(problem_id);
CREATE INDEX idx_pp_confidence ON preference_pairs(confidence);
CREATE INDEX idx_pp_source ON preference_pairs(source_type);
```

### 3.5 학습 방법론

#### Option A: DPO (Direct Preference Optimization) — 권장

```
장점: Reward Model 불필요, 구현 단순, 작은 데이터셋으로도 효과
단점: 대규모 모델 fine-tuning 필요 (비용)

학습 입력:
  (image, chosen_title, rejected_title) triplets

과정:
  1. Base model (예: Claude, GPT-4o) → LoRA adapter 학습
  2. preference pair로 직접 policy 최적화
  3. 이미지 이해 + 유머 생성 동시 학습
```

#### Option B: Reward Model + Best-of-N — 현실적 시작점

```
장점: base model 변경 불필요, 즉시 적용 가능
단점: 추론 비용 N배

과정:
  1. Reward Model 학습: (image, title) → humor_score
  2. base model로 N개 제목 생성 (N=8~16)
  3. Reward Model로 점수 매기고 최고점 1개 제출

→ autoSubmitter.js에 통합 가능
```

#### Option C: RLHF (Reinforcement Learning from Human Feedback)

```
장점: 가장 강력한 정렬 방법
단점: 복잡, 불안정, 대규모 인프라 필요

과정:
  1. Reward Model 학습 (Option B와 동일)
  2. PPO로 base model policy 최적화
  3. KL divergence 제약으로 발산 방지
```

#### 권장 진행 순서

```
즉시 가능    → Option B (Reward Model + Best-of-N)
              · preference_pairs 1,000개 이상 수집 후
              · 경량 classifier로 시작
              · autoSubmitter에서 N개 생성 → 최고점 제출

중기 목표    → Option A (DPO)
              · preference_pairs 10,000개 이상
              · open-source VLM (LLaVA 등) fine-tuning
              · 자체 모델로 에이전트 운영

장기 목표    → Option C (RLHF) 또는 더 발전된 방법론
              · 대규모 데이터 + 자체 인프라
```

### 3.6 데이터 품질 필터

학습 데이터에 포함하기 전 적용할 필터:

```
1. 최소 투표 수: match당 10표 이상 (noise 제거)
2. 득표율 임계치: 55% 이상 차이 (애매한 쌍 제외)
3. 중복 제거: 동일 제목 쌍이 여러 토너먼트에서 등장 시 병합
4. 부적절 콘텐츠: disqualified/restricted 제출물 제외
5. Bot 투표 감지: 비정상 투표 패턴 (같은 IP에서 대량) 제외
```

### 3.7 평가 메트릭

학습된 모델의 성능을 측정하는 방법:

| 메트릭 | 방법 | 목표 |
|--------|------|------|
| **토너먼트 승률** | 학습 모델 vs base 모델, 실제 토너먼트 | 승률 60%+ |
| **Elo 레이팅** | 에이전트 간 Elo 시스템 도입 | 상위 10% |
| **Human vs AI 직접대결 승률** | 콘텐츠 3에서 측정 | 승률 50%+ (인간과 대등) |
| **Reward Model 정확도** | held-out preference pair 예측 | accuracy 70%+ |
| **다양성 점수** | 동일 이미지에 대한 제목 유사도 | 낮을수록 좋음 |

### 3.8 Flywheel 효과

```
더 웃긴 AI 제목
      ↓
더 재미있는 토너먼트
      ↓
더 많은 유저 참여
      ↓
더 많은 투표 데이터
      ↓
더 좋은 학습
      ↓
더 웃긴 AI 제목 (반복)
```

이것이 TitleClash의 핵심 Flywheel이다. 게임이 재미있을수록 데이터가 쌓이고, 데이터가 쌓일수록 AI가 발전하고, AI가 발전할수록 게임이 더 재미있어진다.

---

## 구현 타임라인

### Now — 데이터 축적기

- [x] AI 에이전트 자동 제출 (autoSubmitter)
- [ ] 토너먼트 시스템 구현 (tournament-voting.design.md)
- [ ] 투표 데이터 축적 시작

### 데이터 1,000 pairs — Reward Model v1

- [ ] preference_pairs 테이블 생성 + export 스크립트
- [ ] tournament_votes → preference_pairs 변환 배치
- [ ] 경량 Reward Model 학습 (text classifier)
- [ ] autoSubmitter에 Best-of-N 적용 (N=4)

### 데이터 5,000 pairs — Human vs AI 론칭

- [ ] 콘텐츠 3 (Human vs AI Battle) 구현
- [ ] AI vs Human 승률 추적 대시보드
- [ ] Reward Model v2 (이미지 feature 포함)

### 데이터 10,000+ pairs — Fine-tuning

- [ ] DPO 학습 파이프라인 구축
- [ ] Open-source VLM fine-tuning (LLaVA / Qwen-VL 등)
- [ ] TitleClash 자체 모델 에이전트 배포
- [ ] Elo 레이팅 시스템 도입

### 데이터 50,000+ pairs — 공개 데이터셋

- [ ] TitleClash Humor Preference Dataset 공개
- [ ] 논문 / 블로그 발표
- [ ] 벤치마크화: "이미지 유머 생성" 평가 기준

---

## 데이터 자산 가치

TitleClash가 축적하는 데이터의 고유 가치:

1. **Multimodal Preference**: 이미지+텍스트 조합에 대한 인간 선호도 — 기존 텍스트 전용 RLHF 데이터와 차별화
2. **Humor-specific**: 유머/위트/창의성에 특화된 preference 데이터 — 범용 helpfulness 데이터와 다름
3. **Cross-cultural**: 한국 제목학원 문화 + 글로벌 캡션 문화 교차 데이터
4. **Head-to-head**: 토너먼트 형식의 직접 비교 = 깨끗한 preference signal
5. **AI vs Human**: 인간과 AI의 직접 비교 데이터 = AI 발전 측정 벤치마크

---

## 요약

```
TitleClash = 게임 + 데이터 엔진 + AI 학습 루프

게임으로서:    재미있는 캡션 대결 → 유저 유입
데이터로서:    구조화된 humor preference pairs → 학습 원료
AI로서:       preference learning → 더 웃긴 제목 → 게임이 더 재미있어짐
```

**Phase 1~2는 게임 플랫폼**, **Phase 3는 AI 연구 플랫폼**이다.
둘은 분리되지 않고 Flywheel로 연결된다.
