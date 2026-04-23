/**
 * 회의 페이지 목업 데이터 맵.
 * key = meetingId (CalendarMeeting.id), value = MeetingPageData.
 *
 * 미리 정의된 회의만 풀 데이터가 있고, 나머지는 fallback 생성됨.
 */

import type { MeetingPageData } from "../domain/meetingPageData";

export const meetingPageMocks: Record<string, MeetingPageData> = {
	// 오늘 임시 회의 (주제·자료는 있지만 회의록 아직 없음)
	"mtg-0424-adhoc": {
		id: "mtg-0424-adhoc",
		title: "UI/UX 레이아웃 중간 리뷰",
		date: "2026-04-24",
		time: "16:00",
		durationMinutes: 60,
		type: "adhoc",
		status: "ready",
		attendees: [
			{ id: "m1", name: "유석", role: "PO", attended: null },
			{ id: "m2", name: "경석", role: "PM", attended: null },
			{ id: "m5", name: "우덕", role: "PM", attended: null },
		],
		topics: [
			{
				id: "t1",
				title: "Dashboard vs 공개 진행도 페이지 역할 구분",
				description:
					"두 페이지 모두 '진행도'를 다루는데 어떻게 명확히 구분할지 논의.",
				priority: 1,
				source: "AI",
				reason:
					"최근 회의록에서 '페이지 중복 느낌' 피드백이 2회 등장. 분리 설계가 필요하다고 판단.",
			},
			{
				id: "t2",
				title: "Modal vs Full-page Modal 패턴 결정",
				description: "프로젝트 생성·팀원 가입 시 어떤 방식으로 띄울지.",
				priority: 2,
				source: "AI",
				reason: "when2meet 그리드 입력이 크기 커서 일반 Modal에 맞을지 검증 필요.",
			},
		],
		resources: [
			{
				id: "r1",
				topicId: "t1",
				title: "Notion 페이지 구조 베스트 프랙티스",
				summary:
					"Notion에서 요약 페이지와 상세 페이지를 분리하는 일반적 패턴. 상위 페이지는 지표, 하위 페이지는 타임라인 상세.",
				sourceUrl: "https://example.com/notion-layout",
				collectedAt: "2026-04-24T14:05:00+09:00",
			},
			{
				id: "r2",
				topicId: "t1",
				title: "Linear Dashboard Design Patterns",
				summary:
					"Linear는 team dashboard / personal dashboard를 완전히 분리. 멤버별 activity view가 별도 존재.",
				sourceUrl: "https://example.com/linear-design",
				collectedAt: "2026-04-24T14:07:00+09:00",
			},
			{
				id: "r3",
				topicId: "t2",
				title: "Obsidian Modal vs ItemView 비교",
				summary:
					"Modal은 일시적 입력에, ItemView는 긴 작업에 적합. Modal은 최대 600px 권장.",
				sourceUrl: "https://example.com/obsidian-modal",
				collectedAt: "2026-04-24T14:10:00+09:00",
			},
		],
		minutes: null,
		analysis: null,
	},

	// 이틀 전 임시 회의 (완료 상태, 전체 데이터 있음)
	"mtg-0422-adhoc": {
		id: "mtg-0422-adhoc",
		title: "UI/UX 리뷰",
		date: "2026-04-22",
		time: "16:00",
		durationMinutes: 60,
		type: "adhoc",
		status: "completed",
		attendees: [
			{ id: "m1", name: "유석", role: "PO", attended: true },
			{ id: "m2", name: "경석", role: "PM", attended: true },
			{ id: "m5", name: "우덕", role: "PM", attended: true },
			{ id: "m3", name: "수웅", role: "PM", attended: false },
		],
		topics: [
			{
				id: "t1",
				title: "Dashboard 레이아웃 확정",
				priority: 1,
				source: "AI",
				reason: "이전 회의록에서 '홈 화면 필요' 언급.",
			},
			{
				id: "t2",
				title: "Roadmap: 흐름 vs 간트 비중",
				priority: 2,
				source: "MANUAL",
				reason: null,
			},
			{
				id: "t3",
				title: "팀원별 아바타 색상 규칙",
				priority: 3,
				source: "AI",
				reason: "UI 시안에 멤버 식별 요소 부족.",
			},
		],
		resources: [
			{
				id: "r1",
				topicId: "t1",
				title: "shadcn/ui Dashboard 예시",
				summary: "Card 기반 그리드 레이아웃. 통계 카드 + 세부 섹션 + 사이드.",
				sourceUrl: "https://example.com/shadcn-dashboard",
				collectedAt: "2026-04-22T15:40:00+09:00",
			},
		],
		minutes: {
			content: `결정사항:
- Dashboard는 "큰 그림 요약", 공개 진행도는 "상세 활동" 으로 분리
- Roadmap 뷰는 흐름(기본) / 간트(상세) 토글
- 아바타 색상은 멤버 ID 해시 기반 고정

논의:
- 우덕: "타인 업무는 내 페이지에 안 보였으면" → 확정
- 경석: "서버 연동 시 실시간 갱신 필요" → v2로 이연
- 유석: "프로토타입 마감이 빠르니 MVP 범위 좁게"

다음 액션:
- 유석: Dashboard 목업 완성 (4/24까지)
- 우덕: Modal 중첩 가능성 검증
- 수웅: AI narrative 프롬프트 준비`,
			authorName: "유석",
			writtenAt: "2026-04-22T17:30:00+09:00",
		},
		analysis: {
			keywords: [
				"Dashboard 분리",
				"Roadmap 토글",
				"아바타 색상",
				"MVP 범위",
			],
			techStacks: ["shadcn/ui", "React"],
			decisions: [
				"Dashboard / 공개 진행도 2페이지로 분리",
				"Roadmap: 흐름 + 간트 토글",
				"아바타 색상: 멤버 ID 해시 기반 고정",
				"실시간 서버 갱신: v2로 이연",
			],
			summary:
				"UI/UX 레이아웃 주요 결정: Dashboard와 공개 진행도 2페이지 분리, Roadmap 흐름·간트 토글, 아바타 색상 규칙 확정. MVP 스코프 좁게 유지.",
			analyzedAt: "2026-04-22T17:35:00+09:00",
		},
	},

	// 월요일 정기 회의 (완료)
	"mtg-0420": {
		id: "mtg-0420",
		title: "주간 정기 회의",
		date: "2026-04-20",
		time: "14:00",
		durationMinutes: 60,
		type: "regular",
		status: "completed",
		attendees: [
			{ id: "m1", name: "유석", role: "PO", attended: true },
			{ id: "m2", name: "경석", role: "PM", attended: true },
			{ id: "m3", name: "수웅", role: "PM", attended: true },
			{ id: "m4", name: "동환", role: "PM", attended: true },
			{ id: "m5", name: "우덕", role: "PM", attended: true },
		],
		topics: [
			{
				id: "t1",
				title: "아키텍처 최종 확정",
				priority: 1,
				source: "AI",
				reason: "이전 회의에서 미결.",
			},
			{
				id: "t2",
				title: "MVP 범위 범주 확정",
				priority: 1,
				source: "AI",
				reason: "스프린트 시작 전 필수.",
			},
			{
				id: "t3",
				title: "기술 스택 조사 결과 공유",
				priority: 2,
				source: "MANUAL",
				reason: null,
			},
			{
				id: "t4",
				title: "역할 분담 재확인",
				priority: 3,
				source: "AI",
				reason: "팀원 간 중복 작업 방지.",
			},
			{
				id: "t5",
				title: "논문 일정",
				priority: 4,
				source: "MANUAL",
				reason: null,
			},
		],
		resources: [
			{
				id: "r1",
				topicId: "t1",
				title: "Feature-based vs Layer-based Architecture",
				summary:
					"Feature-based는 UC 단위 응집, 스파게티 방지에 유리. 중간 규모 이상에 추천.",
				sourceUrl: "https://example.com/feature-based",
				collectedAt: "2026-04-20T13:30:00+09:00",
			},
			{
				id: "r2",
				topicId: "t3",
				title: "Yjs + Hocuspocus 성능 벤치마크",
				summary:
					"수백 명 동시 편집도 안정적. Oracle Cloud ARM 무료 티어에서 충분.",
				sourceUrl: "https://example.com/yjs-bench",
				collectedAt: "2026-04-20T13:35:00+09:00",
			},
		],
		minutes: {
			content: `결정사항:
- 아키텍처: Feature-based 확정
- 서버: Yjs + Hocuspocus + SQLite + Oracle Cloud ARM
- MVP: 환경 시나리오 1~4만
- 개발 주체: 유석 + Claude (클라이언트), 경석 (서버)
- 논문 마감: ~4/16 → 이미 지났으니 후속 버전 작성

역할 분담 재확인:
- 유석: 플러그인 클라이언트 전체
- 경석: 서버 (Hocuspocus)
- 수웅: AI 로직 + 논문
- 동환: GitHub 연동 + 논문
- 우덕: UI/UX 피드백`,
			authorName: "유석",
			writtenAt: "2026-04-20T15:15:00+09:00",
		},
		analysis: {
			keywords: ["Feature-based", "Yjs", "Hocuspocus", "MVP 범위", "역할 분담"],
			techStacks: ["Yjs", "Hocuspocus", "SQLite", "Oracle Cloud"],
			decisions: [
				"Feature-based 아키텍처 확정",
				"서버 스택: Yjs + Hocuspocus + SQLite",
				"MVP: 시나리오 1~4만",
				"클라이언트 개발: 유석 단독",
			],
			summary:
				"아키텍처·서버 스택·MVP 범위·역할 분담 확정 회의. Feature-based + Yjs 기반 Hocuspocus 서버로 최종 결정.",
			analyzedAt: "2026-04-20T15:20:00+09:00",
		},
	},
};

/**
 * meetingId 로 MeetingPageData 조회. 없으면 최소 정보로 placeholder 생성.
 */
export function getMeetingPageMock(
	meetingId: string,
	fallback?: {
		title: string;
		date: string;
		time: string;
		type: "regular" | "adhoc";
	},
): MeetingPageData {
	const data = meetingPageMocks[meetingId];
	if (data) return data;

	// Fallback: 캘린더 기본 정보만 있고 나머지는 비어있는 상태
	return {
		id: meetingId,
		title: fallback?.title ?? "회의",
		date: fallback?.date ?? new Date().toISOString().slice(0, 10),
		time: fallback?.time ?? "14:00",
		durationMinutes: 60,
		type: fallback?.type ?? "regular",
		status: "topic_pending",
		attendees: [],
		topics: [],
		resources: [],
		minutes: null,
		analysis: null,
	};
}
