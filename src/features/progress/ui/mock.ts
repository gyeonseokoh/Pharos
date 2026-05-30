/**
 * Dashboard 목업 데이터.
 *
 * 서버·DB 연결 전까지 UI를 띄우기 위한 임의 값.
 * 실제 데이터가 들어오면 이 파일은 삭제하거나 테스트용으로만 쓴다.
 */

import type { DashboardData } from "../domain/dashboardData";

export const mockDashboardData: DashboardData = {
	project: {
		name: "AI 프로젝트 매니저",
		deadline: "2026-06-30",
		daysUntilPrototype: 14,
		totalDays: 68,
	},
	progress: {
		totalTasks: 30,
		completedTasks: 12,
		thisWeekCommits: 45,
	},
	prototypeProgress: {
		percent: 40,
		dday: 14,
	},
	developmentProgress: {
		percent: 25,
		dday: 68,
	},
	myTasks: {
		inProgress: 5,
		total: 8,
		memberName: "유석",
	},
	members: [
		{ id: "m1", name: "유석", checks: 8, commits: 23, role: "PO" },
		{ id: "m2", name: "경석", checks: 5, commits: 18, role: "PM" },
		{ id: "m3", name: "수웅", checks: 3, commits: 7, role: "PM" },
		{ id: "m4", name: "동환", checks: 4, commits: 12, role: "PM" },
		{ id: "m5", name: "우덕", checks: 2, commits: 3, role: "PM" },
	],
	// ── [DEMO] id는 calendarMock·meetingPageMock의 실제 ID와 매핑 ─────────────────
	// 클릭 시 MeetingPageItemView로 이동하기 위해 id를 명시.
	// 새 데이터를 만든 게 아니라 calendarMock.ts에 이미 존재하는 회의의 id를 참조한 것.
	// 실서비스에서는 meetingsService.list()가 id를 포함한 채 반환하므로
	// buildDashboardData에서 m.id를 그대로 전달하면 자동으로 동작한다.
	meetings: [
		{ id: "mtg-0424-adhoc", date: "2026-04-24", time: "14:00", title: "UI/UX 레이아웃 중간 리뷰" },
		{ id: "mtg-0426-adhoc", date: "2026-04-26", time: "19:00", title: "기술 스택 검토 (AI 모델)" },
		{ id: "mtg-0430-adhoc", date: "2026-04-30", time: "10:00", title: "중간발표 리허설" },
	],
	importantDates: [
		{ label: "중간발표", date: "2026-05-14", dday: 21 },
		{ label: "최종 제출", date: "2026-06-30", dday: 68 },
	],
	alerts: [
		{ severity: "danger", text: "P0 미완료 Task 2건 (TASK-003, TASK-007)" },
		{ severity: "warning", text: "이번 주 커밋 없는 팀원 1명: 우덕" },
	],
};
