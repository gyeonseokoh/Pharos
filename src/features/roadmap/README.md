# features/roadmap

**담당 UC**: PO-1 기획 로드맵 생성, PO-6 개발 로드맵 생성

## 파일

### `domain/`
| 파일 | 역할 |
|---|---|
| `Roadmap.ts` | Roadmap/Phase 엔티티 |
| `roadmapService.ts` | 로드맵 CRUD, 승인/재생성 |
| `roadmapGenerator.ts` | LLM으로 Task 목록 + 의존관계 추출 |
| `dependencyGraph.ts` | NetworkX 기반 DAG 구성 + Topological Sort + Critical Path |
| `scheduleCalculator.ts` | 시작일/종료일 계산 (프로젝트 기간 기반) |

### `ui/`
| 파일 | 역할 |
|---|---|
| `GanttView.tsx` | 간트차트 ItemView (gantt-task-react 기반) |
| `RoadmapApprovalModal.tsx` | 생성 후 PO 승인/재생성 Modal |

### `index.ts`
외부 노출:
- `RoadmapService`
- `GanttView`

## 의존성
- `shared/infra/llmClient` (Task 생성)
- `shared/infra/vaultStore` (저장)

## 핵심 규칙
- PO-1은 기획 단계 / PO-6은 개발 단계 — 동일 서비스에서 타입만 분기
- 승인 후에만 저장. 미승인 상태는 초안으로만 존재
- 재생성 시 기존 로드맵은 히스토리로 보존 (PO-1-BR-1)
