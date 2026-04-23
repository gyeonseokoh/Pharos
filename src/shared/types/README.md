# shared/types/

전역 공유 타입 및 상수. 의존성 최소 (Zod만 허용).

## 파일 (예정)

| 파일 | 역할 |
|---|---|
| `entities.ts` | 엔티티 타입 (Project, Member, Task, Meeting, Checklist, Commit 등) |
| `schemas.ts` | Zod 스키마 (런타임 검증용, `entities.ts`와 쌍) |
| `constants.ts` | 공유 상수 (포트, 권한 레벨, UC ID, 이벤트 이름) |
| `roles.ts` | Role 타입 + 권한 체크 유틸 |

## 관례

- **Obsidian/React/외부 SDK 의존성 금지** — 타입 정의만
- feature 자체 타입(예: `features/meeting/domain/Meeting.ts`)과 겹치면:
  - 여러 feature가 쓰는 것 → `shared/types/`
  - 한 feature만 쓰는 것 → feature 내부에 유지
- v2에서 서버와 공유할 때 이 폴더를 참조점으로

## 예시

```ts
// shared/types/entities.ts
export interface Project {
  id: string;
  topic: string;
  description?: string;
  deadline: string; // ISO date
  createdAt: string;
  fixedMeetingToggle: boolean;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  techStacks: string[];
  role: Role;
  isActive: boolean;
}

export type Role = 'READ' | 'WRITE' | 'ADMIN';

export interface Task {
  id: string; // TASK-XXX
  title: string;
  assigneeId: string;
  startDate: string;
  endDate: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  dependsOn: string[];
  checklistIds: string[];
}
```
