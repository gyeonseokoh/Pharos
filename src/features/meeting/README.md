# features/meeting

**담당 UC**: PO-1-1 고정회의, PO-2 주제 생성, PO-3 자료 수집, PO-4 임시회의, PO-5 회의록

## 파일

### `domain/`
| 파일 | UC | 역할 |
|---|---|---|
| `Meeting.ts` | 공통 | Meeting/Topic/Resource 엔티티 |
| `meetingService.ts` | 공통 | CRUD + 회의 페이지(Meetings/{YYYY-MM-DD}.md) 생성 |
| `fixedMeetingScheduler.ts` | PO-1-1 | PM-1 교집합 또는 PO 직접 입력으로 고정회의 생성 |
| `adhocMeetingScheduler.ts` | PO-4 | PM-2 조회 → 후보 3개 분석 → 선택 처리 |
| `topicSuggester.ts` | PO-2 | LLM으로 회의 주제 3~5개 제안 (버튼 트리거) |
| `resourceCollector.ts` | PO-3 | LLM 쿼리 → Tavily → 요약 파이프라인 |
| `minutesAnalyzer.ts` | PO-5 | 회의록 키워드/기술스택/결정사항 추출 |

### `ui/`
| 파일 | UC |
|---|---|
| `CalendarView.tsx` | PO-1-1, PO-4 (캘린더 메인 뷰) |
| `MeetingTopicModal.tsx` | PO-2 (주제 제안 + 선택) |
| `ScheduleMeetingModal.tsx` | PO-4 (임시 회의 후보 선택) |

### `index.ts`
외부 노출:
- `MeetingService`
- `CalendarView`, `MeetingTopicModal`, `ScheduleMeetingModal`

## 의존성
- `shared/infra/llmClient` (주제/자료/회의록)
- `shared/infra/tavilyClient` (PO-3)
- `shared/infra/vaultStore`
- `features/team` 직접 import **금지** — 가용시간은 `container`에서 주입받음

## 회의 페이지 구조 (Vault 내)
```
Meetings/2026-04-23 회의.md
---
## 회의 정보 (일시, 참석자)
## 회의 주제 (PO-2 또는 PO-4)
## 수집 자료 (PO-3 링크)
## 회의록 (PO-5, 사용자 직접 작성)
```
