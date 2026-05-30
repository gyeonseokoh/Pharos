# features/task

**담당 UC**: PO-11 업무 세분화, PM-3 업무 진행 체크

## 파일

### `domain/`
| 파일 | UC | 역할 |
|---|---|---|
| `Task.ts` | 공통 | Task 엔티티 (TASK-XXX 형식) |
| `Checklist.ts` | 공통 | 체크리스트 항목 타입 |
| `taskService.ts` | 공통 | Task CRUD, 담당자 할당 |
| `taskSplitter.ts` | PO-11 | LLM으로 Task → 체크리스트 항목 자동 생성 (MVP: 가중치 생략) |
| `checklistService.ts` | PM-3 | 체크/해제, PM-4 트리거 |

### `ui/`
| 파일 | UC |
|---|---|
| `TaskDetailView.tsx` | 공통 (Task 상세 + 체크리스트) |
| `SplitTaskModal.tsx` | PO-11 (세분화 생성·편집) |

### `index.ts`
외부 노출:
- `TaskService`, `ChecklistService`
- `TaskDetailView`

## 의존성
- `shared/infra/llmClient` (세분화)
- `shared/infra/vaultStore`

## MVP 단순화
- **가중치 시스템 생략** — 단순 체크리스트 항목 수로만 진행도 계산
- PO-10 원본 명세의 가중치 자동 생성/재분배 로직은 v2로 이연
- 커밋 검증 트리거는 PM-4로 이벤트 발행 (`features/progress`가 구독)
