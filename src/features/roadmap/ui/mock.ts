/**
 * Roadmap 목업 데이터.
 *
 * 서버·DB 연결 전까지 UI를 띄우기 위한 임의 값.
 * 실제 데이터가 들어오면 이 파일은 삭제하거나 테스트용으로만 쓴다.
 */

import type { ProjectReport } from "../../../app/settings";
import type { RoadmapData } from "../domain/roadmapData";

export const mockRoadmapData: RoadmapData = {
	project: {
		name: "Pharos — AI 프로젝트 매니저 플러그인",
		start: "2026-04-01",
		end: "2026-06-30",
	},
	phases: [
		{
			id: "phase-plan",
			name: "기획 및 설계",
			start: "2026-04-01",
			end: "2026-04-25",
			status: "done",
			icon: "compass",
			color: "#f97316",
			activities: [
				"주제 구체화 · 문제 정의",
				"유스케이스 17개 정의",
				"환경 시나리오 12개",
				"아키텍처 · 기술스택 확정",
				"UI/UX 레이아웃 설계",
			],
		},
		{
			id: "phase-mvp",
			name: "MVP 기능 개발",
			start: "2026-04-25",
			end: "2026-05-31",
			status: "in-progress",
			icon: "code",
			color: "#3b82f6",
			activities: [
				"프로젝트 생성 (PO-0)",
				"기획 · 개발 로드맵 (PO-1/6)",
				"회의 주제 · 자료 (PO-2/3)",
				"회의록 분석 (PO-5)",
				"체크리스트 · 진척도 (PO-11/12)",
			],
		},
		{
			id: "phase-integration",
			name: "서버 · AI 연동",
			start: "2026-05-15",
			end: "2026-06-15",
			status: "todo",
			icon: "server",
			color: "#8b5cf6",
			activities: [
				"Hocuspocus 서버 연결",
				"JWT 인증 구현",
				"OpenAI 연동",
				"GitHub REST API 연동",
			],
		},
		{
			id: "phase-test",
			name: "통합 테스트 · 논문",
			start: "2026-06-10",
			end: "2026-06-25",
			status: "todo",
			icon: "flask",
			color: "#ec4899",
			activities: ["통합 테스트", "사용자 테스트", "논문 작성"],
		},
		{
			id: "phase-release",
			name: "최종 발표 · 배포",
			start: "2026-06-25",
			end: "2026-06-30",
			status: "todo",
			icon: "rocket",
			color: "#10b981",
			activities: ["시연 영상 제작", "최종 발표 준비", "GitHub Release"],
		},
	],
	tasks: [
		{
			id: "mile-kickoff",
			name: "프로젝트 킥오프",
			kind: "milestone",
			status: "done",
			start: "2026-04-01",
			end: "2026-04-01",
			progress: 100,
		},
		{
			id: "task-topic",
			name: "주제 구체화",
			kind: "task",
			status: "done",
			start: "2026-04-01",
			end: "2026-04-03",
			progress: 100,
			assignee: "유석",
		},
		{
			id: "task-problem",
			name: "문제 정의",
			kind: "task",
			status: "done",
			start: "2026-04-03",
			end: "2026-04-05",
			progress: 100,
			assignee: "유석",
		},
		{
			id: "task-uc",
			name: "유스케이스 정의 (PO-0 ~ PM-4)",
			kind: "task",
			status: "done",
			start: "2026-04-05",
			end: "2026-04-15",
			progress: 100,
			assignee: "유석",
		},
		{
			id: "task-scenario",
			name: "환경 시나리오 작성",
			kind: "task",
			status: "done",
			start: "2026-04-10",
			end: "2026-04-18",
			progress: 100,
			assignee: "유석",
		},
		{
			id: "task-stack",
			name: "기술 스택 조사 · 확정",
			kind: "task",
			status: "done",
			start: "2026-04-08",
			end: "2026-04-20",
			progress: 100,
			assignee: "경석",
		},
		{
			id: "task-arch",
			name: "아키텍처 설계",
			kind: "task",
			status: "done",
			start: "2026-04-20",
			end: "2026-04-22",
			progress: 100,
			assignee: "유석",
		},
		{
			id: "task-ux",
			name: "UI/UX 레이아웃 설계",
			kind: "task",
			status: "in-progress",
			start: "2026-04-22",
			end: "2026-04-25",
			progress: 60,
			assignee: "유석 + 우덕",
		},
		{
			id: "task-mvp",
			name: "MVP 범위 확정 (시나리오 1~4)",
			kind: "task",
			status: "done",
			start: "2026-04-20",
			end: "2026-04-23",
			progress: 100,
			assignee: "유석",
		},
		{
			id: "mile-dev-start",
			name: "개발 로드맵 전환",
			kind: "milestone",
			status: "todo",
			start: "2026-04-25",
			end: "2026-04-25",
			progress: 0,
		},
	],
};

// ───────────────────────── Split Helpers ─────────────────────────

/**
 * 기획 로드맵 — 프로젝트 오버뷰용으로 5 phase 전체 표시.
 *
 * 사용자 요청 (2026-04): 기획 주간에도 전체 프로젝트 흐름(기획→개발→배포)을
 * 한눈에 파악할 수 있어야 해서, pre-B 로드맵 뷰와 동일하게 5 phase 전부 반환.
 * 개발 로드맵 탭은 기획 phase 제외한 4개만 별도로 보여줌.
 *
 * 나중에 llmClient.generatePlanningRoadmap(report) 호출로 교체될 자리.
 */
export function getPlanningRoadmap(report: ProjectReport): RoadmapData {
	return {
		project: overlayProject(report),
		phases: mockRoadmapData.phases,
		tasks: mockRoadmapData.tasks,
	};
}

/**
 * 개발 로드맵 — `phase-plan` 제외한 나머지 phase + 그 기간의 task들.
 *
 * PO-6 "개발 단계로 전환" 버튼이 호출.
 */
export function getDevelopmentRoadmap(report: ProjectReport): RoadmapData {
	const phases = mockRoadmapData.phases.filter((p) => p.id !== "phase-plan");
	const planPhase = mockRoadmapData.phases.find((p) => p.id === "phase-plan");
	const planEnd = planPhase?.end ?? "";
	const tasks = mockRoadmapData.tasks.filter((t) => t.end > planEnd);
	return {
		project: overlayProject(report),
		phases,
		tasks,
	};
}

/** projectReport 기반으로 프로젝트명·마감을 덮어쓴 project 정보. */
function overlayProject(report: ProjectReport): RoadmapData["project"] {
	return {
		name: report.name,
		start: mockRoadmapData.project.start,
		end: report.deadline,
	};
}
