# Pharos Repository 설계 문서

> **상태**: v0.2 (경석 sync 답변 반영) · **갱신일**: 2026-05-06 · **초안**: 2026-04-25
> **목적**: Pharos 데이터 레이어를 단단하게 정의하여 Service·UI·서버·AI 통합의 기반 마련

---

## 0. 이 문서의 목적

지금까지 모든 데이터가 `data.json` 단일 JSON에 박혀 있어서:
- 사용자가 옵시디언에서 직접 편집 못 함
- 서버 동기화 단위로 부적합
- 백엔드/AI 에이전트가 같은 데이터 조작 시 별도 코드 필요

이 문서는 Pharos의 **모든 도메인 데이터를 옵시디언 Vault 안의 `.md` 파일로 저장**하는 설계를 정의한다.
**구현은 이 문서 검수·합의 후에** 시작한다.

---

## 1. 결정된 전제 (회의 합의)

| # | 전제 | 영향 |
|---|---|---|
| 1 | 사용자는 옵시디언에서 .md 파일을 **직접 편집**할 수 있어야 한다 | Vault watch 필수, frontmatter 보존 |
| 2 | 한 사용자가 **여러 디바이스**에서 같은 Vault를 사용한다 | 서버 동기화 필수 |
| 3 | **오프라인** 작업 후 온라인 시 동기화되어야 한다 | 로컬 우선 저장, 후행 sync |
| 4 | **GitHub** 정보는 폴링으로 가져온다 | 외부 데이터 소스로만 취급 |
| 5 | 팀원 간 동시 편집은 **Yjs/CRDT가 자동 해결**한다 | 별도 충돌 해결 로직 X |
| 6 | AI 트리거는 **버튼·자동 실행**만, 자연어 명령 X | NL→함수 매핑 불필요 |
| 7 | **% 진척도·자동 일정 조정 X**, GitHub 커밋 매칭 + 본인 체크만 | "지연 점수" 등 엔티티 X |
| 8 | 보존 등급: **회의록 본문·Task 체크·프로젝트 메타 = 절대 보존**. AI 분석·커밋 캐시 = 재생성 OK | 백업·동기화 우선순위 결정 |

### v0.2 추가 합의 (경석 sync 리뷰 반영)

| # | 전제 | 영향 |
|---|---|---|
| 9 | **모든 .md 쓰기는 `vault.modify` 통일** (열린·닫힌 파일 분기 X) | Service 레이어 단순화 |
| 10 | **닫힌 파일 sync 트리거는 경석 sync 모듈이 처리** (`vault.on('modify')` 활용) | 우리는 동기화 의식 안 해도 됨 |
| 11 | **동기화 필터는 경석님이 만들어 통합 시 주입** | 우리는 hook 자리만 비워둠 |
| 12 | **workspaceId 자동 생성** — Pharos 프로젝트 생성 시 UUID 발급, 초대 링크 포함 | Project 엔티티 필드, Service.create 책임 |
| 13 | **작업 중복 방지용 `.work.json` 메타파일** — 분석·폴링 등 자동 작업 전 lock 체크 | 별도 work 메타 엔티티 도입 |

---

## 2. 디렉토리 구조

```
<옵시디언 Vault 루트>/
└── Pharos/                          ← settings.projectRoot (기본 "Pharos")
    ├── project.md                   ← 프로젝트 메타 (단일 파일)
    ├── _index.json                  ← 빠른 조회용 인덱스 (.json: 옵시디언이 안 보여줌)
    │
    ├── Meetings/                    ← 회의 (정기·임시 모두)
    │   ├── 2026-04-22_UI리뷰.md
    │   ├── 2026-04-22_UI리뷰.work.json   ← 작업 상태 (분석 완료 등, 사용자 안 보임)
    │   ├── 2026-04-25_긴급회의.md
    │   └── ...
    │
    ├── Roadmap/                     ← 로드맵
    │   ├── planning.md              ← 기획 로드맵
    │   └── development.md           ← 개발 로드맵
    │
    ├── Tasks/                       ← 개별 Task
    │   ├── TASK-001.md
    │   ├── TASK-002.md
    │   └── ...
    │
    ├── Team/                        ← 팀원
    │   ├── 유석.md
    │   ├── 경석.md
    │   └── ...
    │
    ├── Availability/                ← 주간 가용시간 (ISO 주차별)
    │   ├── 2026-W17.md
    │   └── ...
    │
    ├── Commits/                     ← GitHub 커밋 (월별 묶음, 캐시)
    │   ├── 2026-04.md
    │   └── ...
    │
    └── Memos/                       ← 사용자 자유 메모
        ├── m-001.md
        └── ...
```

**원칙**:
- 사용자가 자주 보는 것 = 별도 파일 (Meetings, Tasks, Memos)
- 1:1 또는 작은 객체 = 단일 파일 (project, Roadmap)
- 양 많고 시계열 = 묶음 파일 (Commits 월별, Availability 주차별)
- 사용자에게 숨길 파일 = `.json`·`.work.json` 등 **.md 외 확장자** (옵시디언이 사이드바에 안 보여줌)
- 자동 캐시·작업 메타는 사용자 가시 영역 밖에 둠

---

## 3. frontmatter 공통 규칙

모든 .md 파일은 다음 공통 키를 가진다:

```yaml
---
version: 1                          # 스키마 버전. 마이그레이션 시 ↑
type: meeting                       # 엔티티 타입 (meeting/task/...)
id: mtg-2026-0422-ui-review         # 전역 유니크 ID
createdAt: 2026-04-22T15:00:00+09:00
updatedAt: 2026-04-22T17:30:00+09:00
---
```

- **`version`**: 스키마 변경 시 마이그레이션 트리거
- **`type`**: 엔티티 식별자 (오타 방지·검증용)
- **`id`**: 전역 유니크. 다른 .md 에서 참조 시 사용
- **`createdAt`/`updatedAt`**: ISO 8601 + timezone

**키 컨벤션**: camelCase (`authorName`), 한글 키 X.

---

## 4. 엔티티별 상세

### 4.1. Project (`project.md`)

프로젝트 메타. 단일 파일. 필수.

```yaml
---
version: 1
type: project
id: proj-pharos
name: Pharos
description: AI PM Agent for Obsidian
deadline: 2026-08-30
fixedMeetingMode: manual            # auto | manual
fixedMeetingDay: 1                  # 0-6 (manual일 때만)
fixedMeetingTime: "14:00"           # HH:MM (manual일 때만)
planningRoadmapGenerated: true
developmentRoadmapGenerated: true
workspaceId: ws-7c8a3b9d-...        # Hocuspocus 동기화 식별자 (UUID 자동 발급)
createdAt: 2026-04-25T10:00:00+09:00
updatedAt: 2026-04-25T10:00:00+09:00
---

# Pharos

(자유 텍스트 — 프로젝트 소개, 노션 식 위키 가능)
```

**workspaceId**: 프로젝트 생성 시 `crypto.randomUUID()` 로 자동 발급. 초대 링크에 포함되어 팀원이 같은 workspace 자동 세팅 (PO-9 팀원 초대 작업에서 deep link 처리 추가 예정).

### 4.2. Meeting (`Meetings/<date>_<slug>.md`)

회의 1건 = 파일 1개. **회의록·분석·주제·자료 모두 한 파일에 통합**.

파일명: `2026-04-22_UI리뷰.md` (날짜 + 슬러그)

```yaml
---
version: 1
type: meeting
id: mtg-2026-0422-ui-review
title: UI/UX 리뷰
date: 2026-04-22
time: "16:00"
durationMinutes: 60
meetingType: adhoc                  # regular | adhoc
status: completed                   # topic_pending | ready | completed
attendees:
  - { id: m1, name: 유석, role: PO, attended: true }
  - { id: m2, name: 경석, role: PM, attended: true }
topics:
  - id: t1
    title: Dashboard 레이아웃 확정
    priority: 1
    source: AI                      # AI | MANUAL
    reason: 이전 회의록에서 '홈 화면 필요' 언급
resources:
  - id: r1
    topicId: t1
    title: shadcn/ui Dashboard 예시
    summary: Card 기반 그리드 레이아웃...
    sourceUrl: https://example.com/...
    collectedAt: 2026-04-22T15:40:00+09:00
minutes:
  authorName: 유석
  writtenAt: 2026-04-22T17:30:00+09:00
analysis:
  keywords: [Dashboard 분리, Roadmap 토글]
  techStacks: [shadcn/ui, React]
  decisions:
    - Dashboard / 공개 진행도 분리
    - Roadmap: 흐름 + 간트 토글
  summary: UI/UX 레이아웃 주요 결정...
  categories: [feature]             # feature | progress
  analyzedAt: 2026-04-22T17:35:00+09:00
createdAt: 2026-04-22T15:00:00+09:00
updatedAt: 2026-04-22T17:35:00+09:00
---

# UI/UX 리뷰

## 결정사항
- Dashboard는 "큰 그림 요약", 공개 진행도는 "상세 활동" 으로 분리
- Roadmap 뷰는 흐름(기본) / 간트(상세) 토글
- 아바타 색상은 멤버 ID 해시 기반 고정

## 논의
- 우덕: "타인 업무는 내 페이지에 안 보였으면" → 확정
- ...

## 다음 액션
- 유석: Dashboard 목업 완성 (4/24까지)
- ...
```

**중요**: 본문 = 회의록 그 자체 (사용자가 직접 작성). frontmatter = 메타.

### 4.3. Roadmap

기획·개발 각 1개 파일.

#### 4.3.1. `Roadmap/planning.md`

```yaml
---
version: 1
type: roadmap
roadmapKind: planning               # planning | development
id: roadmap-planning
projectId: proj-pharos
generatedAt: 2026-04-22T10:00:00+09:00
phases:
  - id: phase-launch
    name: 착수
    start: 2026-04-22
    end: 2026-04-30
    status: completed
    color: "#3b82f6"
    activities: [팀 구성, 컨셉 확정]
  - id: phase-plan
    name: 기획
    start: 2026-05-01
    end: 2026-05-15
    status: in-progress
    color: "#8b5cf6"
    activities: [요구사항 도출, 우선순위 결정]
tasks: []                           # 기획 단계는 phase 위주, task 비어있어도 OK
createdAt: 2026-04-22T10:00:00+09:00
updatedAt: 2026-04-22T10:00:00+09:00
---

# 기획 로드맵

(선택) 사용자가 직접 추가할 수 있는 노트 영역
```

#### 4.3.2. `Roadmap/development.md`

`tasks` 배열 안에 Task 요약만 (전체는 `Tasks/TASK-XXX.md`).

```yaml
---
version: 1
type: roadmap
roadmapKind: development
id: roadmap-development
projectId: proj-pharos
generatedAt: 2026-04-25T15:00:00+09:00
project:
  start: 2026-04-25
  end: 2026-08-30
phases:
  - id: dev-mvp
    name: MVP 기능 개발
    start: 2026-04-25
    end: 2026-06-11
    status: todo
    color: "#3b82f6"
    activities: [핵심 기능 구현, UI 통합]
tasks:
  - id: task-dev-001               # 실제 파일은 Tasks/TASK-001.md
    name: Dashboard 역할 구분
    start: 2026-04-25
    end: 2026-05-02
    assignee: 유석
    sourceMeetings: [mtg-2026-0424-adhoc]
createdAt: 2026-04-25T15:00:00+09:00
updatedAt: 2026-04-25T15:00:00+09:00
---
```

**참고**: `tasks` 배열은 로드맵 전체 표시용 요약. 상세는 별도 Task 파일.

### 4.4. Task (`Tasks/TASK-001.md`)

```yaml
---
version: 1
type: task
id: TASK-001
roadmapId: roadmap-development      # 어느 로드맵에 속한 Task인가
phaseId: dev-mvp
title: Dashboard 역할 구분
description: Dashboard와 공개 진행도 페이지의 역할을 명확히 구분
status: in-progress                 # todo | in-progress | done | blocked
userChecked: false                  # 본인 완료 체크 (PO-10 합의 사항)
priority: HIGH                      # HIGH | MEDIUM | LOW
phase: PLANNING                     # PLANNING | DEVELOPMENT
startDate: 2026-04-25
endDate: 2026-05-02
assignee: { id: m1, name: 유석, role: PO }
dependsOn: []                       # 의존 Task ID 배열
sourceMeetings: [mtg-2026-0424-adhoc]
checklist:
  - { id: c1, text: 레이아웃 목업, checked: true, checkedAt: ..., checkedBy: 유석 }
  - { id: c2, text: 컴포넌트 분리, checked: false }
linkedCommits:
  - { sha: 1839c75, message: 'feat(TASK-001): ...', author: 유석, date: ..., verifyResult: verified }
createdAt: 2026-04-25T15:00:00+09:00
updatedAt: 2026-04-25T15:00:00+09:00
---

# Dashboard 역할 구분

(자유 노트 — 사용자가 작업 중 메모)
```

### 4.5. TeamMember (`Team/<name>.md`)

각 팀원 1파일.

```yaml
---
version: 1
type: team-member
id: m1
name: 유석
role: PO                            # PO | PM
permission: ADMIN                   # READ | WRITE | ADMIN
techStacks: [TypeScript, React, Obsidian]
joinedAt: 2026-04-01
status: active                      # active | left | invited
createdAt: 2026-04-01T00:00:00+09:00
updatedAt: 2026-04-25T00:00:00+09:00
---

# 유석

(자유 프로필 노트)
```

### 4.6. Availability (`Availability/2026-W17.md`)

ISO 주차별 1파일. 주간 가용시간 그리드.

```yaml
---
version: 1
type: availability
id: avail-2026-W17
weekStart: 2026-04-20               # 월요일
slots:
  - { memberId: m1, day: 1, start: "14:00", end: "16:00" }   # 월요일 14-16
  - { memberId: m1, day: 2, start: "10:00", end: "12:00" }
  - { memberId: m2, day: 1, start: "13:00", end: "17:00" }
createdAt: 2026-04-19T00:00:00+09:00
updatedAt: 2026-04-20T09:00:00+09:00
---
```

### 4.7. Commit (`Commits/2026-04.md`)

월별 1파일. 커밋 캐시 (재생성 가능, 등급 🟢).

```yaml
---
version: 1
type: commit-batch
id: commits-2026-04
month: 2026-04
syncedAt: 2026-04-25T00:00:00+09:00
commits:
  - sha: 1839c75
    taskId: TASK-001
    message: 'feat(TASK-001): Dashboard 리팩토링'
    author: 유석
    date: 2026-04-24T14:10:00+09:00
    verifyResult: verified
    filesChanged: 5
    linesAdded: 124
    linesRemoved: 78
createdAt: 2026-04-01T00:00:00+09:00
updatedAt: 2026-04-25T00:00:00+09:00
---
```

### 4.8. Memo (`Memos/m-001.md`)

사용자 자유 메모 (미구현 기능, 모양만 정의).

```yaml
---
version: 1
type: memo
id: m-001
title: 다음 회의 때 물어볼 것
tags: [meeting-prep]
createdAt: 2026-04-25T10:00:00+09:00
updatedAt: 2026-04-25T10:00:00+09:00
---

# 다음 회의 때 물어볼 것

- API 키 누가 관리할지
- ...
```

### 4.9. _index.json (자동 생성 캐시)

빠른 조회용 인덱스. 사용자가 보지 않아도 됨. 자동 갱신.
**확장자 `.json`** — 옵시디언이 사이드바에서 안 보여줌 (사용자에게 숨김).

```json
{
  "version": 1,
  "type": "index",
  "generatedAt": "2026-04-25T15:00:00+09:00",
  "meetings": [
    { "id": "mtg-...", "file": "Meetings/2026-04-22_UI리뷰.md", "date": "2026-04-22", "type": "adhoc" }
  ],
  "tasks": [
    { "id": "TASK-001", "file": "Tasks/TASK-001.md", "status": "in-progress", "assignee": "유석" }
  ],
  "team": [
    { "id": "m1", "file": "Team/유석.md", "role": "PO" }
  ]
}
```

**용도**: 매번 모든 .md 스캔 안 해도 되도록 빠른 검색. 1차 진실은 개별 .md, 인덱스는 캐시.
**동기화 제외**: 디바이스마다 자체 빌드 (서버에 안 올림). 경석 sync 필터에서 제외 처리.

### 4.10. `*.work.json` (작업 상태 메타)

엔티티 .md 파일 옆에 `<basename>.work.json` 으로 함께 존재.
용도: **여러 사용자 플러그인이 같은 자동 작업(분석·폴링 등)을 중복 수행하지 않도록 lock·결과 공유**.

```json
{
  "version": 1,
  "type": "work-state",
  "targetFile": "Meetings/2026-04-22_UI리뷰.md",
  "operations": {
    "ai-analysis": {
      "status": "completed",
      "performedBy": "m1",
      "performedAt": "2026-04-22T17:35:00+09:00"
    },
    "github-commit-sync": {
      "status": "in-progress",
      "performedBy": "m4",
      "startedAt": "2026-04-25T08:00:00+09:00"
    }
  }
}
```

**규칙**:
- 모든 자동 작업(분석, 폴링, 알림)은 시작 전 `.work.json` 의 해당 op 확인
- `status: "completed"` 또는 `"in-progress"` 면 건너뜀
- 작업 완료 시 status 갱신 + 결과 메타 작성
- **동기화 O** — 팀원 모두가 같은 작업 상태 공유
- 사용자에게 안 보임 (`.work.json` 확장자)

(race condition 우려는 회의에서 추가 논의 — 일단 last-write-wins로 시작, 문제 시 lock 메커니즘 도입)

---

## 5. Repository 인터페이스

각 엔티티마다 한 인터페이스. CRUD + 검색 + watch.

### 5.1. 공통 베이스

```typescript
interface Repository<T extends { id: string }> {
  list(filter?: FilterOf<T>): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
  watch(callback: (event: ChangeEvent<T>) => void): Disposable;
}

type ChangeEvent<T> =
  | { kind: "created"; entity: T }
  | { kind: "updated"; entity: T; before: T }
  | { kind: "deleted"; id: string };
```

### 5.2. 엔티티별 Repository

```typescript
interface ProjectRepository {
  get(): Promise<Project | null>;
  save(project: Project): Promise<void>;
  reset(): Promise<void>;             // 시연용 초기화
  watch(cb: (p: Project | null) => void): Disposable;
}

interface MeetingRepository extends Repository<Meeting> {
  listByDate(start: string, end: string): Promise<Meeting[]>;
  listByStatus(status: MeetingStatus): Promise<Meeting[]>;
  listByCategory(category: MeetingCategory): Promise<Meeting[]>;
}

interface RoadmapRepository {
  getPlanning(): Promise<Roadmap | null>;
  getDevelopment(): Promise<Roadmap | null>;
  savePlanning(roadmap: Roadmap): Promise<void>;
  saveDevelopment(roadmap: Roadmap): Promise<void>;
  deleteDevelopment(): Promise<void>;
  watch(cb: (kind: "planning" | "development") => void): Disposable;
}

interface TaskRepository extends Repository<Task> {
  listByAssignee(memberId: string): Promise<Task[]>;
  listByPhase(phaseId: string): Promise<Task[]>;
  listByStatus(status: TaskStatus): Promise<Task[]>;
  setUserCheck(taskId: string, checked: boolean): Promise<void>;
  appendCommit(taskId: string, commit: Commit): Promise<void>;
}

interface TeamRepository extends Repository<TeamMember> {
  listActive(): Promise<TeamMember[]>;
  setStatus(id: string, status: MemberStatus): Promise<void>;
}

interface AvailabilityRepository {
  getByWeek(weekStart: string): Promise<Availability | null>;
  saveSlots(weekStart: string, slots: AvailabilitySlot[]): Promise<void>;
  watch(cb: (week: string) => void): Disposable;
}

interface CommitRepository {
  listByTask(taskId: string): Promise<Commit[]>;
  listByMonth(month: string): Promise<Commit[]>;
  upsertBatch(commits: Commit[]): Promise<void>;
  // 폴링 결과 일괄 저장
}

interface MemoRepository extends Repository<Memo> {
  listByTag(tag: string): Promise<Memo[]>;
}
```

---

## 6. 저장 매체별 구현 전략

각 Repository 인터페이스마다 **3개 구현체**:

```
┌─ Repository (interface)
│
├─ SettingsRepository       ← 1단계: 현재 data.json 기반 (마이그레이션 전)
├─ VaultRepository          ← 2단계: Vault MD 파일 기반
└─ ServerRepository         ← 3단계: Hocuspocus + Yjs 동기화 (랩핑)
```

### 6.1. VaultRepository 구현 핵심

```typescript
class VaultMeetingRepository implements MeetingRepository {
  constructor(private vault: Vault, private indexer: VaultIndexer) {}

  async getById(id: string): Promise<Meeting | null> {
    const path = await this.indexer.findPath("meeting", id);
    if (!path) return null;
    const file = this.vault.getAbstractFileByPath(path) as TFile;
    const raw = await this.vault.read(file);
    return this.parseMd(raw);
  }

  async save(meeting: Meeting): Promise<void> {
    const path = this.computePath(meeting);                  // Meetings/2026-04-22_UI리뷰.md
    const md = this.serializeToMd(meeting);
    const existing = this.vault.getAbstractFileByPath(path);
    if (existing) {
      await this.vault.modify(existing as TFile, md);
    } else {
      await this.vault.create(path, md);
    }
    await this.indexer.upsert("meeting", meeting.id, path);
  }

  // ...
}
```

### 6.2. Frontmatter 파싱·직렬화

`gray-matter` 라이브러리 사용:

```typescript
import matter from "gray-matter";

function parseMd<T>(raw: string, schema: ZodSchema<T>): T {
  const { data, content } = matter(raw);
  const parsed = schema.parse(data);                         // Zod 검증
  return { ...parsed, body: content };
}

function serializeToMd(entity: T): string {
  const { body, ...frontmatter } = entity;
  return matter.stringify(body ?? "", frontmatter);
}
```

### 6.3. Vault Watch (사용자 직접 편집 감지)

```typescript
class VaultMeetingRepository {
  watch(cb: (event: ChangeEvent<Meeting>) => void): Disposable {
    const handler = async (file: TAbstractFile) => {
      if (!file.path.startsWith("Pharos/Meetings/")) return;
      // 1) 인덱스 갱신
      // 2) 파싱
      // 3) cb 호출
    };
    this.vault.on("create", handler);
    this.vault.on("modify", handler);
    this.vault.on("delete", handler);
    return { dispose: () => { /* off */ } };
  }
}
```

### 6.4. ServerRepository (Yjs 위임 — v0.2 단순화)

**ServerRepository는 별도로 구현하지 않음**. VaultRepository 그대로 사용 + Vault 자체가 Hocuspocus로 동기화되는 구조:

```
[클라이언트 A]            [클라이언트 B]
   Vault MD                 Vault MD
      ↕                        ↕
   Hocuspocus 서버 (Yjs doc, .md 단위 동기화)
```

### 6.5. 파일 쓰기 정책 (v0.2 확정)

경석 sync 모듈과 합의된 정책 — **모든 .md 쓰기는 `vault.modify` 통일**, 분기 X:

```typescript
// 모든 Repository.save() 내부에서:
await this.vault.modify(file, newMd);  // 또는 vault.create

// 끝. yText API 직접 호출 X. 파일 열림·닫힘 분기 X.
```

**이유**:
- 열린 파일: 옵시디언이 에디터 reload → yCollab 이 yText 갱신 → 자동 sync
- 닫힌 파일: 경석 sync 모듈이 `vault.on('modify')` 이벤트로 sync 트리거 (별도 hook 만듦)

**우리 책임 범위**:
- frontmatter 직렬화 (`stringifyFrontmatter`)
- `vault.modify` 호출
- 그 외 동기화 메커니즘은 경석 sync 모듈이 처리

**예외**: 빠른 multi-write 묶음 (예: 마이그레이션 시 100개 파일 일괄 쓰기) 같은 케이스는 통합 시점에 별도 검토.

### 6.6. 동기화 필터 (경석 모듈)

어떤 파일이 sync 대상인지는 경석 sync 모듈이 정의:
- 우리는 `Pharos/` 폴더 안의 .md만 동기화 대상으로 가정
- `_index.json`, `.work.json` 같은 메타파일은 sync 제외 (각 디바이스 별도 유지)
- 구체적 필터 규칙은 통합 시점에 경석님 코드에 맞춰 적용

---

## 7. 마이그레이션 정책

### 7.1. 트리거

옵시디언 켰을 때:
1. `data.json`에 `migrated: true` 플래그 확인
2. 없거나 false면 → 마이그레이션 다이얼로그 표시
3. 사용자 동의 → 변환 시작

### 7.2. 변환 흐름

```
data.json 읽음
  ↓
project.md 생성 (settings.projectReport)
Roadmap/planning.md 생성 (planningRoadmapGenerated가 true이면 mock에서 가져옴)
Roadmap/development.md 생성 (settings.developmentRoadmap)
Tasks/TASK-XXX.md 생성 (각 Task)
Meetings/<date>_<title>.md 생성 (settings.attachedMinutes + meetingPageMocks)
Team/<name>.md 생성 (mockTeamListData)
  ↓
_index.md 생성 (전체 인덱스)
data.json에 migrated: true 기록
  ↓
플러그인 리로드 → 새 시스템으로 동작
```

### 7.3. 실패 시 (선택 A: 싹 되돌림)

```typescript
async function migrate() {
  const backup = await backupDataJson();
  try {
    await migrateProject();
    await migrateMeetings();
    await migrateRoadmap();
    await migrateTasks();
    await migrateTeam();
    await markMigrated();
  } catch (err) {
    await restoreFromBackup(backup);
    await deleteCreatedMdFiles();              // 부분 생성된 .md 정리
    throw err;
  }
}
```

원자적 보장 어려우면 **chunk 단위** (project → meetings → ... 각각 별도 트랜잭션):
- 한 chunk 실패 시 그 chunk 만 롤백
- 사용자에게 "어디까지 진행됨" 표시

### 7.4. 사용자 다이얼로그 모양

```
┌──────────────────────────────────────────┐
│  Pharos 데이터 형식 업그레이드           │
│                                          │
│  Pharos가 모든 데이터를 옵시디언          │
│  마크다운 파일로 저장하도록 업그레이드   │
│  됩니다.                                  │
│                                          │
│  변환되는 항목:                           │
│  • 프로젝트 정보 1건                     │
│  • 회의 12건                             │
│  • 로드맵 (기획·개발)                    │
│  • Task 18건                             │
│  • 팀원 5명                              │
│                                          │
│  소요 시간: 약 5초                       │
│  실패 시 자동 복구됩니다.                 │
│                                          │
│       [나중에]    [업그레이드 시작]       │
└──────────────────────────────────────────┘
```

---

## 8. 버전 관리 (스키마 진화)

미래에 frontmatter 키가 추가·변경될 때:

```typescript
function parseEntity(raw: any): Meeting {
  const version = raw.version ?? 1;
  switch (version) {
    case 1: return parseV1(raw);
    case 2: return migrateV1ToV2(parseV1(raw));   // 자동 마이그레이션
    default: throw new Error(`Unknown version: ${version}`);
  }
}
```

**규칙**:
- 키 추가만 = 버전 그대로 (구버전 호환)
- 키 의미 변경·필수 추가 = 버전 ↑
- 한 마이너 버전당 한 가지 변경만 (롤백 가능)

---

## 9. Zod 스키마 (검증)

각 엔티티에 Zod 스키마 정의:

```typescript
// src/features/meeting/domain/meetingSchema.ts
export const MeetingSchemaV1 = z.object({
  version: z.literal(1),
  type: z.literal("meeting"),
  id: z.string(),
  title: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meetingType: z.enum(["regular", "adhoc"]),
  status: z.enum(["topic_pending", "ready", "completed"]),
  attendees: z.array(MeetingAttendeeSchema),
  topics: z.array(MeetingTopicSchema),
  resources: z.array(MeetingResourceSchema),
  minutes: MeetingMinutesSchema.nullable(),
  analysis: MeetingAnalysisSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Meeting = z.infer<typeof MeetingSchemaV1>;
```

**잘못된 .md 파일 감지 시**:
- 콘솔 에러 + 사용자 Notice
- 해당 파일은 무시, 인덱스에 "broken" 표시
- 다른 파일은 정상 동작

---

## 10. 성능 고려

### 10.1. 인덱스 캐시 (`_index.md`)

- 회의 100건일 때 매번 100개 .md 파싱 = 느림
- `_index.md` 에 메타만 (id, file path, 주요 필드)
- 상세 조회 시에만 개별 .md 읽기
- Vault 변경 감지 시 인덱스 자동 갱신

### 10.2. 지연 로딩

- 회의록 본문은 `getById()` 호출 시에만 읽음
- 목록 페이지 = 인덱스만 보고 카드 렌더
- 상세 페이지 = 그때 본문 fetch

### 10.3. 평균 데이터 크기 가정 (검증 필요)

| 엔티티 | 1건 평균 크기 | 학기 누적 |
|---|---|---|
| Meeting | 5KB (본문 포함) | 30건 = 150KB |
| Task | 1KB | 50건 = 50KB |
| Commit | 0.3KB | 500건 = 150KB |
| 전체 | | **~500KB** |

500KB 정도는 옵시디언이 즉시 처리 가능. 문제없음.

---

## 11. Open Questions (팀 리뷰 시 결정)

### 결정된 것 (v0.2)

| Q | 결정 |
|---|---|
| `_index.md` 가시성 | `_index.json` 으로 변경 (옵시디언이 안 보여줌) |
| 동기화 트리거·필터 | 경석 sync 모듈이 처리 (우리는 hook 자리만) |
| workspaceId 정책 | Project 생성 시 UUID 자동 발급, 초대 링크 포함 |
| 작업 중복 방지 | `*.work.json` 메타파일로 lock·결과 공유 |
| 파일 쓰기 | `vault.modify` 통일 (열린·닫힌 분기 X) |

### 아직 미결정

1. **회의 파일명에 한글 허용**? (예: `2026-04-22_UI리뷰.md` vs `2026-04-22_ui-review.md`)
   - 권장: 한글 OK (옵시디언이 잘 처리)

2. **Task 파일명**: `TASK-001.md` 같은 ID 형식 vs `Dashboard-역할-구분.md` 같은 슬러그
   - 권장: ID (`TASK-XXX.md`)

3. **로드맵 변경 추적** (Audit Trail)?
   - MVP 범위: X (단순화)
   - v2: 별도 `Roadmap/_history/` 디렉토리

4. **사용자가 .md 파일 이름을 직접 바꾸면**?
   - 옵시디언이 자체적으로 link 갱신, 우리는 인덱스 재구성으로 대응
   - ID는 frontmatter 안에 있어야 함 (파일명에 의존 X)

5. **첨부 파일 (PDF, 이미지 등) 처리**?
   - MVP: URL만 저장, 다운로드 X
   - v2: `Pharos/Attachments/` 폴더

6. **`.work.json` race condition** (두 사용자 동시 자동 작업 시도)?
   - 우선: last-write-wins (단순)
   - 문제 시: 분산 lock 메커니즘 추가

---

## 12. 다음 단계

이 문서가 합의되면:
1. `service-design.md` — Service 레이어 설계
2. `sync-design.md` — Yjs·오프라인·GitHub 폴링 설계
3. 위 3개 문서 모두 합의되면 구현 시작 (4주)

---

## 13. 변경 이력

| 일자 | 변경 | 작성자 |
|---|---|---|
| 2026-04-25 | 초안 v0.1 | 유석 + Claude |
| 2026-05-06 | v0.2 — 경석 sync 리뷰 반영: vault.modify 통일, workspaceId 자동화, .work.json 메타, _index.json (확장자 변경), 동기화 필터·트리거 책임 정의 | 유석 + Claude |
