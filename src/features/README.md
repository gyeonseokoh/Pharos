# features/

**UC(유스케이스) 단위로 응집된 코드.** 각 feature는 관련 UC들의 domain(로직) + ui(컴포넌트)를 한 곳에 모음.

## Feature 목록 (MVP 기준 6개)

| Feature | UC 담당 |
|---|---|
| `project/` | PO-0 프로젝트 계획서 관리 |
| `roadmap/` | PO-1 기획 로드맵, PO-6 개발 로드맵 |
| `meeting/` | PO-1-1 고정회의, PO-2 주제, PO-3 자료, PO-4 임시회의, PO-5 회의록 |
| `team/` | PO-9 팀 동기화/권한, PM-1 초기 가용시간, PM-2 주간 가용시간 |
| `task/` | PO-11 업무 세분화, PM-3 체크리스트 |
| `progress/` | PO-12 멤버 진행도, PM-4 커밋 검증 |

## 🔒 불변 규칙 3개 (스파게티 방지)

### 규칙 1: feature 간 직접 import 금지
`features/meeting`이 `features/team`을 **직접 import하지 못함**.
공유가 필요하면 `shared/`로 승격하거나, `app/container.ts`를 통해 이벤트/서비스로 주고받음.

```ts
// ❌ 금지
import { availabilityService } from "../team/domain/availabilityService";

// ✅ 허용 — shared로 승격한 경우
import { SharedEvents } from "../../shared/infra/events";
```

### 규칙 2: barrel export(`index.ts`)만 외부 노출
각 feature의 `index.ts`가 허용한 것만 밖에서 쓸 수 있음. 내부 파일(`domain/*`, `ui/*`)은 숨김.

```ts
// features/meeting/index.ts
export { MeetingService } from "./domain/MeetingService";
export { CalendarView } from "./ui/CalendarView";
// topicSuggester, resourceCollector는 export 안 함 → 외부에서 못 씀
```

### 규칙 3: domain ↔ ui 분리
- `domain/`: 순수 로직. React/Obsidian API 의존 X. 테스트 용이.
- `ui/`: React 컴포넌트. 외부 API(OpenAI 등) 직접 호출 X — domain 경유.

```ts
// ✅ ui → domain 호출
const suggestions = await meetingService.suggestTopics(ctx);

// ❌ ui에서 OpenAI 직접 호출
const res = await openai.chat.completions.create({...});
```

## 📁 표준 feature 구조

```
features/{name}/
├── domain/          ← 순수 로직
│   ├── {Entity}.ts       (타입 + 팩토리)
│   ├── {name}Service.ts  (도메인 서비스)
│   └── *.ts              (세부 로직)
├── ui/              ← React 컴포넌트
│   ├── {Name}View.tsx    (ItemView 래퍼 + React)
│   ├── {Name}Modal.tsx   (Modal + React)
│   └── components/       (feature 전용 소컴포넌트)
└── index.ts         ← barrel export (외부 API 정의)
```

## 새 feature 추가 방법

1. `features/newname/` 폴더 생성
2. `domain/`, `ui/` 하위 폴더 + `index.ts` 생성
3. 이 README에 feature 목록 갱신
4. 필요하면 `app/container.ts`에 DI 등록
