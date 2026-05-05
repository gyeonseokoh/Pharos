# Pharos Repository 구조 — 팀 공유 요약

> v0.2 · 갱신일: 2026-05-06 · 초안: 2026-04-25
> 상세본: [repository-design.md](repository-design.md)
> v0.2 변경: 경석 sync 리뷰 반영 (vault.modify 통일·workspaceId 자동화·.work.json 메타파일·_index 확장자)

---

## 한 줄 요약

**모든 Pharos 데이터를 옵시디언 Vault 안의 `.md` 파일로 저장하고, 각 데이터 종류마다 Repository(데이터 접근 어댑터)를 둔다.**

---

## 왜 이렇게 하는가

### 지금 문제

- 모든 데이터가 `data.json` 한 파일에 박혀있음
- 사용자가 옵시디언에서 직접 편집 못 함
- 서버 동기화 단위로 부적합 (Yjs는 .md 파일 단위 동기화에 강함)
- 백엔드/AI가 같은 데이터 다루려면 전부 다시 짜야 함

### 바뀐 후

- 각 데이터 종류마다 폴더 + Repository 클래스
- 사용자가 옵시디언에서 .md 직접 편집 가능 (노션 스타일)
- Yjs로 .md 파일 그대로 팀원 간 동기화
- UI·백엔드·AI 모두 같은 Repository 호출 → 코드 재사용

---

## 폴더 구조

```
<옵시디언 Vault>/
└── Pharos/
    ├── project.md               ← 프로젝트 메타 (1개)
    ├── _index.json              ← 자동 인덱스 (.json: 옵시디언이 안 보여줌)
    │
    ├── Meetings/                ← 회의 1건 = 파일 1개
    │   ├── 2026-04-22_UI리뷰.md
    │   └── 2026-04-22_UI리뷰.work.json   ← 작업 상태 (분석 lock 등, 사용자 안 보임)
    │
    ├── Roadmap/
    │   ├── planning.md          ← 기획 로드맵
    │   └── development.md       ← 개발 로드맵
    │
    ├── Tasks/                   ← Task 1개 = 파일 1개
    │   └── TASK-001.md
    │
    ├── Team/                    ← 팀원 1명 = 파일 1개
    │   └── 유석.md
    │
    ├── Availability/            ← 주차별 가용시간
    │   └── 2026-W17.md
    │
    ├── Commits/                 ← 월별 커밋 캐시
    │   └── 2026-04.md
    │
    └── Memos/                   ← 자유 메모
        └── m-001.md
```

---

## Repository 8개

각 Repository = "어떤 데이터를 어떻게 다룰지" 정의한 인터페이스.
사용자 코드는 `xxxRepository.getById(...)` 한 줄로 데이터 가져옴.

| Repository | 다루는 것 | 폴더 위치 |
|---|---|---|
| `ProjectRepository` | 프로젝트 메타 | `project.md` (1개) |
| `MeetingRepository` | 회의 (정기·임시) | `Meetings/*.md` |
| `RoadmapRepository` | 로드맵 (기획·개발) | `Roadmap/*.md` |
| `TaskRepository` | 개별 Task | `Tasks/*.md` |
| `TeamRepository` | 팀원 정보 | `Team/*.md` |
| `AvailabilityRepository` | 주간 가용시간 | `Availability/*.md` |
| `CommitRepository` | GitHub 커밋 매칭 캐시 | `Commits/*.md` |
| `MemoRepository` | 자유 메모 | `Memos/*.md` |

---

## 사용 예시 (객체지향 스타일)

```typescript
// 회의 1건 가져오기
const meeting = await meetingRepository.getById("mtg-001");
console.log(meeting.title);              // "UI/UX 리뷰"
console.log(meeting.minutes.content);    // 회의록 본문

// 모든 회의 목록
const all = await meetingRepository.list();

// 카테고리별 필터
const featureMeetings = await meetingRepository.listByCategory("feature");

// Task 가져오기
const task = await taskRepository.getById("TASK-001");
console.log(task.assignee.name);         // "유석"
console.log(task.checklist);             // [...]

// 본인 완료 체크
await taskRepository.setUserCheck("TASK-001", true);

// 팀원 목록
const activeMembers = await teamRepository.listActive();
```

---

## 엔티티별 스키마

각 .md 파일은 **frontmatter (메타) + 본문 (자유 텍스트)** 구조.

### 공통 필드 (모든 엔티티)

```yaml
version: 1                        # 스키마 버전
type: meeting                     # 엔티티 타입
id: mtg-001                       # 전역 유니크 ID
createdAt: 2026-04-22T15:00:00+09:00
updatedAt: 2026-04-22T17:30:00+09:00
```

### Project

```typescript
interface Project {
  id: string;                     // "proj-pharos"
  name: string;
  description: string;
  deadline: string;               // ISO date
  fixedMeetingMode: "auto" | "manual";
  fixedMeetingDay?: number;
  fixedMeetingTime?: string;
  planningRoadmapGenerated: boolean;
  developmentRoadmapGenerated: boolean;
  workspaceId: string;            // Hocuspocus sync ID, UUID 자동 발급
}
```

### Meeting (회의 — 가장 큼)

```typescript
interface Meeting {
  id: string;                     // "mtg-2026-0422-ui-review"
  title: string;
  date: string;                   // ISO date
  time: string;                   // "16:00"
  durationMinutes: number;
  meetingType: "regular" | "adhoc";
  status: "topic_pending" | "ready" | "completed";
  attendees: { id, name, role, attended }[];
  topics: { id, title, priority, source, reason }[];
  resources: { id, topicId, title, summary, sourceUrl }[];
  minutes: { authorName, writtenAt } | null;       // 본문은 .md body
  analysis: {
    keywords: string[];
    techStacks: string[];
    decisions: string[];
    summary: string;
    categories: ("feature" | "progress")[];        // 다중 분류 OK
  } | null;
}
```

### Roadmap

```typescript
interface Roadmap {
  roadmapKind: "planning" | "development";
  projectId: string;
  generatedAt: string;
  project: { name, start, end };
  phases: { id, name, start, end, status, color, activities }[];
  tasks: { id, name, start, end, assignee, sourceMeetings }[];   // 요약만
}
```

### Task

```typescript
interface Task {
  id: string;                     // "TASK-001"
  roadmapId: string;
  phaseId: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done" | "blocked";
  userChecked: boolean;           // 본인 완료 체크 (PO-10)
  priority: "HIGH" | "MEDIUM" | "LOW";
  startDate: string;
  endDate: string;
  assignee: { id, name, role };
  dependsOn: string[];            // → Task ID
  sourceMeetings: string[];       // → Meeting ID
  checklist: { id, text, checked, checkedAt, checkedBy }[];
  linkedCommits: { sha, message, author, date, verifyResult }[];
}
```

### TeamMember

```typescript
interface TeamMember {
  id: string;                     // "m1"
  name: string;
  role: "PO" | "PM";
  permission: "READ" | "WRITE" | "ADMIN";
  techStacks: string[];
  joinedAt: string;
  status: "active" | "left" | "invited";
}
```

### Availability

```typescript
interface Availability {
  id: string;                     // "avail-2026-W17"
  weekStart: string;              // 월요일 ISO date
  slots: {
    memberId: string;             // → TeamMember
    day: number;                  // 0-6
    start: string;                // "14:00"
    end: string;                  // "16:00"
  }[];
}
```

### CommitBatch (월별)

```typescript
interface CommitBatch {
  id: string;                     // "commits-2026-04"
  month: string;                  // "2026-04"
  syncedAt: string;
  commits: {
    sha: string;
    taskId: string | null;        // → Task (없으면 매칭 실패)
    message: string;
    author: string;
    date: string;
    verifyResult: "verified" | "unverified" | "rejected";
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
  }[];
}
```

### Memo

```typescript
interface Memo {
  id: string;                     // "m-001"
  title: string;
  tags: string[];
  // 본문은 .md body
}
```

---

## 엔티티 관계도

```
                ┌───────────────┐
                │   Project     │  (1개)
                └───────┬───────┘
                        │ 1:1
              ┌─────────┴──────────┐
              ▼                    ▼
      ┌──────────────┐    ┌──────────────┐
      │  Roadmap     │    │   Meeting    │  (N개)
      │ (기획·개발)   │    │              │
      └──────┬───────┘    └──────┬───────┘
             │ 1:N               │
             ▼                   │ N:N (sourceMeetings)
      ┌──────────────┐◄──────────┘
      │    Task      │  (N개)
      └──┬─────┬─────┘
         │     │
   N:1   │     │  N:1
         ▼     ▼
   ┌────────┐  ┌────────────┐
   │ Member │  │  Commit    │
   └───┬────┘  └────────────┘
       │ N:N (주차별)
       ▼
┌──────────────┐
│ Availability │
└──────────────┘

   Memo (독립, tag로 자유 연결)
```

---

## 회의에서 합의된 전제 (재확인)

| # | 전제 |
|---|---|
| 1 | 사용자는 .md 파일을 직접 편집할 수 있음 (노션처럼) |
| 2 | 한 사용자가 여러 디바이스에서 동일 Vault 사용 |
| 3 | 오프라인 작업 후 온라인 시 동기화 |
| 4 | 팀원 간 동시 편집은 Yjs/CRDT가 자동 해결 (충돌 없음 가정) |
| 5 | AI는 버튼·자동 트리거로만 실행, 자연어 명령 X |
| 6 | GitHub은 폴링으로 가져옴 |
| 7 | % 진척도·자동 일정 조정 X. GitHub 커밋 매칭 + 본인 체크만 |
| 8 | 회의록 본문·Task 체크 = 절대 보존 / AI 분석 = 재생성 OK |
| 9 | 마이그레이션은 다이얼로그로 사용자 동의 후 |
| 10 | 마이그레이션 실패 시 자동 롤백 |

### v0.2 추가 (경석 sync 리뷰)

| # | 전제 |
|---|---|
| 11 | 모든 .md 쓰기는 `vault.modify` 통일 (열린·닫힌 분기 X) |
| 12 | 닫힌 파일 sync 트리거는 경석 sync 모듈이 처리 |
| 13 | 동기화 필터는 경석님 코드에 통합 시 적용, 우리는 hook 자리만 |
| 14 | workspaceId 자동 생성 (UUID), 초대 링크에 포함 |
| 15 | `.work.json` 메타파일로 자동 작업 중복 방지 |

---

## 저장 매체 전환 전략 (단계별)

같은 Repository 인터페이스 위에 3개 구현체:

```
인터페이스: MeetingRepository
              │
              ├── 1단계: SettingsMeetingRepository (data.json 기반, 지금 우리)
              ├── 2단계: VaultMeetingRepository (.md 파일 기반)
              └── 3단계: ServerMeetingRepository (Hocuspocus + Yjs)
```

**UI 코드는 어떤 구현인지 모름** — `meetingRepository.getById(...)` 한 줄만 호출. 구현체 교체는 `main.ts` 한 줄 수정.

---

## 같이 결정해야 할 것 (Open Questions)

리뷰하면서 답해줘:

1. **회의 파일명 한글 OK?** — `2026-04-22_UI리뷰.md` vs `2026-04-22_ui-review.md`
2. **Task 파일명 형식** — `TASK-001.md` vs `Dashboard-역할-구분.md`
3. **AI 분석 결과를 frontmatter에 넣음** OK? (지금 안)
4. **로드맵 변경 이력 추적** 필요? (MVP X, v2 가능)
5. **사용자가 .md 파일명 변경하면** 어떻게 처리? (frontmatter id 우선)
6. **첨부 파일** (PDF 등) 처리 방식 — MVP는 URL만, 다운로드 X

---

## 다음 단계

1. **이 문서 리뷰** — 팀원이 본인 영역 (서버·AI·GitHub) 관점에서 빠진 거 짚어줌
2. **Open Questions 답변**
3. **Service 레이어 설계 문서** 작성 (Repository 위에 얹는 비즈니스 로직)
4. **Sync 설계 문서** 작성 (Yjs·오프라인·GitHub 폴링)
5. **3개 문서 합의 후 구현 시작** (4주)

---

## 영역별 리뷰 포인트

### 경석 (서버)

- 6장 ServerRepository 전략 — Yjs로 .md 파일 통째 동기화 가능한지
- Hocuspocus의 파일 어댑터 활용 가능한지
- 오프라인 → 온라인 전환 시 동기화 시나리오

### 수웅 (AI)

- Meeting의 `analysis` 필드 모양 — LLM 응답을 frontmatter에 넣는 방식 OK?
- AI가 호출할 Repository 메서드 (지금 정의된 것에서 부족한 게 있는지)
- 분석 결과 캐싱 전략 (재분석 시 덮어쓰기 vs 히스토리)

### 동환 (GitHub)

- `CommitRepository` 인터페이스 — 폴링으로 들어오는 커밋 처리에 충분한지
- 월별 묶음 vs Task별 묶음 어느 쪽이 좋은지
- 커밋 ↔ Task 매칭 실패 시 처리 (`taskId: null`)

### 우덕 (UI/UX)

- 사용자가 옵시디언에서 .md 직접 편집 시 UI 반영 방식
- 마이그레이션 다이얼로그 디자인
- _index.md 파일이 사용자에게 보이는 게 OK인지 (숨길 방법?)

---

**검토 후 의견 댓글이나 카톡으로 줘.**
