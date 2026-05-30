# features/progress

**담당 UC**: PO-12 멤버 진행도 공유, PM-4 진척도 검증

## 파일

### `domain/`
| 파일 | UC | 역할 |
|---|---|---|
| `progressService.ts` | PO-12 | 진행도 집계 오케스트레이션 |
| `progressAggregator.ts` | PO-12 | GitHub 커밋 + 체크리스트 → 멤버별 요약 생성 |
| `commitVerifier.ts` | PM-4 | `feat(TASK-XXX):` 패턴 매칭 + verified/unverified 판정 (MVP 단순화) |
| `dashboardRenderer.ts` | PO-12 | 공개 진행도 MD 파일 자동 갱신 |
| `memberTimelineRenderer.ts` | PO-12 | 개인 타임라인 MD 파일 자동 갱신 |

### `ui/`
| 파일 | UC |
|---|---|
| `DashboardView.tsx` | PO-12 공개 진행도 (팀 전체 공개) |
| `MemberTimelineView.tsx` | PO-12 개인 타임라인 (본인 전용) |

### `index.ts`
외부 노출:
- `ProgressService`
- `DashboardView`, `MemberTimelineView`

## 의존성
- `shared/infra/githubClient` (커밋 폴링)
- `shared/infra/vaultStore`
- `shared/scheduler/scheduler` (매일 자정 갱신)

## 집계 규칙 (MVP)
- **갱신 주기**: 매일 자정(KST) + 수동 버튼. 회의 직전 자동은 v2.
- **집계 범위**: 1일 (KST 00:00 ~ 24:00)
- **커밋 매칭**: `feat(TASK-XXX):` / `fix(TASK-XXX):` 정규식
- **진행도 표시**:
  - 전체 체크리스트 완료율 (%)
  - 멤버별 오늘 체크 수 / 커밋 수
  - 시나리오 4: 마감 D-day + 미완료 P0 Task 리스트 + 경고 알림
- **2페이지 분리**:
  - 개인 타임라인 (본인 전용) — 내 업무 + 체크리스트
  - 공개 진행도 (팀 전체) — 멤버별 오늘 요약
