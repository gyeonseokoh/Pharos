# features/project

**담당 UC**: PO-0 프로젝트 계획서 관리

## 파일

### `domain/`
| 파일 | 역할 |
|---|---|
| `Project.ts` | Project 엔티티 타입 + 생성자 |
| `projectService.ts` | 프로젝트 CRUD, 생성 시 초기 Vault 구조(Dashboard/, Meetings/ 등) 자동 생성 |
| `fixedMeetingToggle.ts` | 고정회의 on/off 토글 처리 로직 |

### `ui/`
| 파일 | 역할 |
|---|---|
| `NewProjectModal.tsx` | 프로젝트 보고서 입력 Modal (주제·마감기한·고정회의 토글 등) |

### `index.ts` (barrel)
외부 노출:
- `ProjectService` (타입)
- `NewProjectModal` (컴포넌트)

## 의존성
- `shared/infra/vaultStore` (프로젝트 파일 생성)
- `shared/types/common` (공통 타입)

## 트리거
- 명령 팔레트 "Pharos: New Project"
- 대시보드 버튼
