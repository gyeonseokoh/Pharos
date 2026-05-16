/**
 * 공개 진행도 페이지 목업 데이터.
 * 실제 데이터가 들어오면 이 파일은 삭제하거나 테스트용으로만 쓴다.
 *
 * 시나리오: 오늘 = 2026-04-24 (금).
 * 이번 주 범위 = 2026-04-19 (일) ~ 2026-04-25 (토).
 * 멤버별로 월·화·수·목·금 중 여러 날 활동이 섞여 있음.
 */

import type { ProgressPageData } from "../domain/progressPageData";

export const mockProgressPageData: ProgressPageData = {
	projectName: "AI 프로젝트 매니저",
	lastUpdated: "2026-04-24T14:32:00+09:00",
	period: {
		start: "2026-04-24",
		end: "2026-04-24",
		label: "오늘",
	},
	team: {
		totalChecks: 22,
		totalCommits: 63,
		activeMembers: 4,
		totalMembers: 5,
	},
	members: [
		{
			id: "m1",
			name: "유석",
			role: "PO",
			stats: {
				checksToday: 8,
				commitsToday: 23,
				checksThisWeek: 14,
				commitsThisWeek: 52,
			},
			narrative:
				"UI/UX 레이아웃 설계에 집중. Dashboard·Roadmap 컴포넌트 목업을 완성했고, shadcn/ui 기반 공용 컴포넌트를 정비했음.",
			recentActivity: [
				// 금 (오늘)
				{
					type: "check",
					timestamp: "2026-04-24T14:32:00+09:00",
					taskId: "TASK-008",
					taskTitle: "UI/UX 레이아웃 설계",
					itemText: "Dashboard 프로그레스 바 구현",
				},
				{
					type: "commit",
					timestamp: "2026-04-24T14:10:00+09:00",
					sha: "1839c75",
					message: "feat(TASK-008): Dashboard 리팩토링 - props 기반 구조",
					taskId: "TASK-008",
					filesChanged: 5,
					linesAdded: 124,
					linesRemoved: 78,
				},
				{
					type: "commit",
					timestamp: "2026-04-24T13:45:00+09:00",
					sha: "a8f3b21",
					message: "feat(TASK-008): 프로그레스 카드 프로토타입·개발 분리",
					taskId: "TASK-008",
					filesChanged: 2,
					linesAdded: 54,
					linesRemoved: 12,
				},
				{
					type: "check",
					timestamp: "2026-04-24T11:20:00+09:00",
					taskId: "TASK-008",
					taskTitle: "UI/UX 레이아웃 설계",
					itemText: "Roadmap 화살표 체인 구현",
				},
				{
					type: "commit",
					timestamp: "2026-04-24T10:55:00+09:00",
					sha: "c4e9d07",
					message: "feat(TASK-008): Roadmap 흐름/간트 토글",
					taskId: "TASK-008",
					filesChanged: 3,
					linesAdded: 342,
					linesRemoved: 45,
				},
				// 목
				{
					type: "commit",
					timestamp: "2026-04-23T18:30:00+09:00",
					sha: "468f841",
					message: "feat(TASK-007): Pharos 플러그인 초기 스캐폴딩",
					taskId: "TASK-007",
					filesChanged: 28,
					linesAdded: 1658,
					linesRemoved: 75,
				},
				{
					type: "check",
					timestamp: "2026-04-23T16:45:00+09:00",
					taskId: "TASK-007",
					taskTitle: "프로젝트 구조 세팅",
					itemText: "feature-based 아키텍처 스캐폴딩",
				},
				{
					type: "commit",
					timestamp: "2026-04-23T15:10:00+09:00",
					sha: "2f8b3a4",
					message: "chore(TASK-007): Tailwind + shadcn/ui 세팅",
					taskId: "TASK-007",
					filesChanged: 8,
					linesAdded: 203,
					linesRemoved: 15,
				},
				// 수
				{
					type: "check",
					timestamp: "2026-04-22T14:20:00+09:00",
					taskId: "TASK-006",
					taskTitle: "아키텍처 설계",
					itemText: "UiAdapter / Notifier 인터페이스 정의",
				},
				// 화
				{
					type: "commit",
					timestamp: "2026-04-21T16:00:00+09:00",
					sha: "9e7d2c8",
					message: "docs(TASK-005): MVP 범위 문서 정리",
					taskId: "TASK-005",
					filesChanged: 2,
					linesAdded: 87,
					linesRemoved: 3,
				},
			],
		},
		{
			id: "m2",
			name: "경석",
			role: "PM",
			stats: {
				checksToday: 5,
				commitsToday: 18,
				checksThisWeek: 11,
				commitsThisWeek: 38,
			},
			narrative:
				"Hocuspocus 서버 스켈레톤 작업 진행 중. SQLite 연결과 JWT 미들웨어 프로토타입 완료.",
			recentActivity: [
				// 금 (오늘)
				{
					type: "commit",
					timestamp: "2026-04-24T13:50:00+09:00",
					sha: "7b2c5f8",
					message: "feat(TASK-012): Hocuspocus onAuthenticate 훅 연결",
					taskId: "TASK-012",
					filesChanged: 4,
					linesAdded: 89,
					linesRemoved: 3,
				},
				{
					type: "check",
					timestamp: "2026-04-24T13:20:00+09:00",
					taskId: "TASK-012",
					taskTitle: "서버 인증 구현",
					itemText: "JWT 토큰 검증 로직",
				},
				{
					type: "commit",
					timestamp: "2026-04-24T11:10:00+09:00",
					sha: "e3a1d44",
					message: "feat(TASK-011): SQLite better-sqlite3 어댑터",
					taskId: "TASK-011",
					filesChanged: 2,
					linesAdded: 67,
					linesRemoved: 0,
				},
				// 수
				{
					type: "commit",
					timestamp: "2026-04-22T17:30:00+09:00",
					sha: "5c9b1e2",
					message: "feat(TASK-012): Hocuspocus 서버 기본 구동",
					taskId: "TASK-012",
					filesChanged: 6,
					linesAdded: 245,
					linesRemoved: 0,
				},
				{
					type: "check",
					timestamp: "2026-04-22T15:10:00+09:00",
					taskId: "TASK-012",
					taskTitle: "서버 인증 구현",
					itemText: "Oracle Cloud ARM 환경 세팅",
				},
				// 월
				{
					type: "check",
					timestamp: "2026-04-20T13:40:00+09:00",
					taskId: "TASK-011",
					taskTitle: "데이터 저장소",
					itemText: "Yjs + Hocuspocus 리서치 완료",
				},
			],
		},
		{
			id: "m3",
			name: "수웅",
			role: "PM",
			stats: {
				checksToday: 3,
				commitsToday: 7,
				checksThisWeek: 6,
				commitsThisWeek: 15,
			},
			narrative:
				"논문 초록 방향성 정리. AI 프롬프트 테스트 작업도 병행 중 (PO-2 회의 주제 제안 프롬프트 설계).",
			recentActivity: [
				// 금 (오늘)
				{
					type: "commit",
					timestamp: "2026-04-24T15:05:00+09:00",
					sha: "9f4b2c1",
					message: "feat(TASK-015): PO-2 주제 제안 프롬프트 초안",
					taskId: "TASK-015",
					filesChanged: 1,
					linesAdded: 48,
					linesRemoved: 0,
				},
				{
					type: "check",
					timestamp: "2026-04-24T10:30:00+09:00",
					taskId: "TASK-015",
					taskTitle: "AI 프롬프트 설계",
					itemText: "Few-shot 예시 3개 수집",
				},
				// 목
				{
					type: "commit",
					timestamp: "2026-04-23T14:20:00+09:00",
					sha: "4d7e9a2",
					message: "docs(TASK-020): 논문 초록 초안",
					taskId: "TASK-020",
					filesChanged: 1,
					linesAdded: 95,
					linesRemoved: 0,
				},
				// 월
				{
					type: "check",
					timestamp: "2026-04-20T16:15:00+09:00",
					taskId: "TASK-020",
					taskTitle: "논문 작성",
					itemText: "관련 연구 서베이",
				},
			],
		},
		{
			id: "m4",
			name: "동환",
			role: "PM",
			stats: {
				checksToday: 4,
				commitsToday: 12,
				checksThisWeek: 10,
				commitsThisWeek: 28,
			},
			narrative:
				"GitHub REST API 클라이언트 작업. 커밋 조회 + 패턴 매칭(feat(TASK-XXX)) 구현 완료.",
			recentActivity: [
				// 금 (오늘)
				{
					type: "commit",
					timestamp: "2026-04-24T14:20:00+09:00",
					sha: "6d8f1a3",
					message: "feat(TASK-018): githubClient 폴링 로직",
					taskId: "TASK-018",
					filesChanged: 3,
					linesAdded: 112,
					linesRemoved: 8,
				},
				{
					type: "check",
					timestamp: "2026-04-24T13:00:00+09:00",
					taskId: "TASK-018",
					taskTitle: "GitHub 연동",
					itemText: "커밋 메시지 정규식 매칭",
				},
				{
					type: "commit",
					timestamp: "2026-04-24T12:15:00+09:00",
					sha: "2a5c9e6",
					message: "feat(TASK-018): 레이트 리밋 처리",
					taskId: "TASK-018",
					filesChanged: 1,
					linesAdded: 23,
					linesRemoved: 4,
				},
				// 목
				{
					type: "commit",
					timestamp: "2026-04-23T17:30:00+09:00",
					sha: "8c4e7b1",
					message: "feat(TASK-018): GitHub REST API 클라이언트 스켈레톤",
					taskId: "TASK-018",
					filesChanged: 4,
					linesAdded: 156,
					linesRemoved: 0,
				},
				{
					type: "check",
					timestamp: "2026-04-23T14:45:00+09:00",
					taskId: "TASK-018",
					taskTitle: "GitHub 연동",
					itemText: "인증 토큰 설정",
				},
				// 화
				{
					type: "commit",
					timestamp: "2026-04-21T18:00:00+09:00",
					sha: "0f3a5d7",
					message: "docs(TASK-019): 논문 관련 코드 뷰어 설계 정리",
					taskId: "TASK-019",
					filesChanged: 1,
					linesAdded: 63,
					linesRemoved: 0,
				},
			],
		},
		{
			id: "m5",
			name: "우덕",
			role: "PM",
			stats: {
				checksToday: 0,
				commitsToday: 0,
				checksThisWeek: 2,
				commitsThisWeek: 3,
			},
			narrative:
				"Obsidian 구현 가능성 검증 작업. 주 초반 Modal · ItemView 테스트 프로토타입 완료.",
			recentActivity: [
				// 수
				{
					type: "commit",
					timestamp: "2026-04-22T19:00:00+09:00",
					sha: "3b1e4f9",
					message: "chore(TASK-009): Modal + ItemView 테스트 프로토타입",
					taskId: "TASK-009",
					filesChanged: 2,
					linesAdded: 78,
					linesRemoved: 0,
				},
				{
					type: "check",
					timestamp: "2026-04-22T17:40:00+09:00",
					taskId: "TASK-009",
					taskTitle: "Obsidian 구현 검증",
					itemText: "Modal 중첩 가능 여부 테스트",
				},
				// 화
				{
					type: "commit",
					timestamp: "2026-04-21T16:30:00+09:00",
					sha: "7a2c8d5",
					message: "docs(TASK-009): Obsidian API 실험 결과 정리",
					taskId: "TASK-009",
					filesChanged: 1,
					linesAdded: 124,
					linesRemoved: 0,
				},
				{
					type: "check",
					timestamp: "2026-04-21T14:20:00+09:00",
					taskId: "TASK-009",
					taskTitle: "Obsidian 구현 검증",
					itemText: "Ribbon / Status Bar API 조사",
				},
				{
					type: "commit",
					timestamp: "2026-04-21T11:00:00+09:00",
					sha: "c8f5b3a",
					message: "chore(TASK-009): 테스트 Vault 세팅",
					taskId: "TASK-009",
					filesChanged: 1,
					linesAdded: 15,
					linesRemoved: 0,
				},
			],
		},
	],
};
