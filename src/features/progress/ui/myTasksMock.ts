/**
 * 내 업무 뷰 목업 데이터.
 * 시나리오: 유석(PO) 기준. 오늘 = 2026-04-24.
 */

import type { MyTasksData } from "../domain/myTasksData";

export const mockMyTasksData: MyTasksData = {
	profile: {
		id: "m1",
		name: "유석",
		role: "PO",
	},
	stats: {
		totalTasks: 6,
		inProgressTasks: 2,
		todoTasks: 3,
		doneTasks: 1,
		totalChecklistItems: 24,
		completedChecklistItems: 12,
		dueTodayTasks: 1,
	},
	tasks: [
		{
			id: "TASK-008",
			title: "UI/UX 레이아웃 설계",
			description:
				"Dashboard, Roadmap, 공개 진행도, 내 업무 뷰 등 핵심 뷰 레이아웃을 shadcn/ui 기반으로 설계한다.",
			startDate: "2026-04-22",
			endDate: "2026-04-25",
			status: "in-progress",
			priority: "HIGH",
			phase: "PLANNING",
			checklist: [
				{
					id: "c1",
					text: "Dashboard 레이아웃 목업",
					checked: true,
					checkedAt: "2026-04-23T18:30:00+09:00",
				},
				{
					id: "c2",
					text: "Roadmap 흐름 + 간트 차트 뷰",
					checked: true,
					checkedAt: "2026-04-24T10:55:00+09:00",
				},
				{
					id: "c3",
					text: "공개 진행도 페이지",
					checked: true,
					checkedAt: "2026-04-24T14:10:00+09:00",
				},
				{
					id: "c4",
					text: "내 업무 뷰 (개인 타임라인)",
					checked: false,
					checkedAt: null,
				},
				{
					id: "c5",
					text: "캘린더 뷰",
					checked: false,
					checkedAt: null,
				},
				{
					id: "c6",
					text: "Modal 3개 (프로젝트 생성 / 가입 / 회의 주제)",
					checked: false,
					checkedAt: null,
				},
			],
		},
		{
			id: "TASK-009",
			title: "아키텍처 리뷰 및 확정",
			description:
				"Feature-based 구조 + Store/Notifier/UiAdapter 인터페이스 리뷰. 블록 구조(props 기반 데이터 주입) 검증.",
			startDate: "2026-04-24",
			endDate: "2026-04-24",
			status: "in-progress",
			priority: "HIGH",
			phase: "PLANNING",
			checklist: [
				{
					id: "c1",
					text: "domain / ui 분리 원칙 준수",
					checked: true,
					checkedAt: "2026-04-24T11:00:00+09:00",
				},
				{
					id: "c2",
					text: "Dashboard/Roadmap 블록 구조 리팩토링",
					checked: true,
					checkedAt: "2026-04-24T13:30:00+09:00",
				},
				{
					id: "c3",
					text: "팀원 피드백 수렴",
					checked: false,
					checkedAt: null,
				},
			],
		},
		{
			id: "TASK-010",
			title: "프로젝트 생성 Modal (PO-0)",
			description:
				"프로젝트 보고서 입력 폼. 주제·마감·고정회의 on/off 토글 + 팀원 초대 링크 생성.",
			startDate: "2026-04-25",
			endDate: "2026-04-28",
			status: "todo",
			priority: "HIGH",
			phase: "DEVELOPMENT",
			checklist: [
				{ id: "c1", text: "Modal 레이아웃 + 폼 필드", checked: false, checkedAt: null },
				{ id: "c2", text: "Zod 검증 로직", checked: false, checkedAt: null },
				{ id: "c3", text: "고정회의 on/off 토글 UI", checked: false, checkedAt: null },
				{ id: "c4", text: "Vault 파일 구조 자동 생성", checked: false, checkedAt: null },
			],
		},
		{
			id: "TASK-011",
			title: "팀원 가입 + when2meet Modal (PM-1)",
			description:
				"초대 링크 클릭 → Modal 오픈 → 회원가입 + 기술스택 + when2meet 스타일 가용시간 입력.",
			startDate: "2026-04-29",
			endDate: "2026-05-02",
			status: "todo",
			priority: "MEDIUM",
			phase: "DEVELOPMENT",
			checklist: [
				{ id: "c1", text: "회원가입 폼", checked: false, checkedAt: null },
				{ id: "c2", text: "기술스택 자동완성 입력", checked: false, checkedAt: null },
				{ id: "c3", text: "when2meet 그리드 컴포넌트", checked: false, checkedAt: null },
				{ id: "c4", text: "제출 로직", checked: false, checkedAt: null },
			],
		},
		{
			id: "TASK-012",
			title: "AI 회의 주제 제안 Modal (PO-2)",
			description:
				"회의 페이지에서 '주제 생성' 버튼 → LLM 호출 → 3~5개 주제 제안 → PO가 선택/직접 입력.",
			startDate: "2026-05-03",
			endDate: "2026-05-05",
			status: "todo",
			priority: "MEDIUM",
			phase: "DEVELOPMENT",
			checklist: [
				{ id: "c1", text: "llmClient 스켈레톤", checked: false, checkedAt: null },
				{ id: "c2", text: "주제 제안 프롬프트 설계", checked: false, checkedAt: null },
				{ id: "c3", text: "Modal UI + 선택 로직", checked: false, checkedAt: null },
			],
		},
		{
			id: "TASK-007",
			title: "Pharos 플러그인 초기 스캐폴딩",
			description:
				"Feature-based 폴더 구조 + Tailwind/shadcn/ui 세팅 + shared/infra 기초.",
			startDate: "2026-04-22",
			endDate: "2026-04-23",
			status: "done",
			priority: "HIGH",
			phase: "PLANNING",
			checklist: [
				{
					id: "c1",
					text: "폴더 구조 + README 작성",
					checked: true,
					checkedAt: "2026-04-23T14:20:00+09:00",
				},
				{
					id: "c2",
					text: "Tailwind + PostCSS + Pretendard",
					checked: true,
					checkedAt: "2026-04-23T15:30:00+09:00",
				},
				{
					id: "c3",
					text: "shared/ui: Button, Card",
					checked: true,
					checkedAt: "2026-04-23T16:40:00+09:00",
				},
				{
					id: "c4",
					text: "shared/infra: VaultStore, Notifier, UiAdapter",
					checked: true,
					checkedAt: "2026-04-23T18:10:00+09:00",
				},
			],
		},
	],
};
