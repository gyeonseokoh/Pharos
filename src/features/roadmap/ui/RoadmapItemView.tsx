/**
 * RoadmapItemView — RoadmapView(React 컴포넌트)를 Obsidian ItemView 탭으로 감싸는 어댑터.
 *
 * 상태별 분기:
 *   1) projectReport === null         → "프로젝트 먼저 생성" empty
 *   2) 기획 로드맵 미생성              → "✨ AI 기획 로드맵 생성하기" 버튼
 *   3) 기획 있음 / 개발 없음           → 기획 탭 표시, 개발 탭 🔒 + "개발 단계로 전환" 버튼
 *   4) 둘 다 있음                      → 탭 2개 활성, 기본 = 개발
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { RoadmapView } from "./RoadmapView";
import { RoadmapEmptyView } from "./RoadmapEmptyView";
import { RoadmapGenerateView } from "./RoadmapGenerateView";
import { DevRoadmapGenerateModal } from "./DevRoadmapGenerateModal";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import { roadmapToData } from "../domain/roadmapData";
// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────────
// 연동 완료 후 이 import 줄을 삭제하세요.
import { mockRoadmapData } from "./mock";
// ──────────────────────────────────────────────────────────────────────────────
import type { PharosPluginLike, ProjectReport } from "../../../app/settings";
import type { RoadmapData } from "../domain/roadmapData";
import type { RoadmapInput } from "../domain/roadmapSchema";
// 시나리오.md §8 데이터 흐름: PO-2·PO-5 회의 데이터 → PO-6 개발 로드맵 입력
import type { MeetingPageData } from "../../meeting/domain/meetingPageData";

export const VIEW_TYPE_PHAROS_ROADMAP = "pharos-roadmap-view";

export class RoadmapItemView extends ItemView {
	private root: Root | null = null;
	// ── [DEMO] 승인된 개발 로드맵을 메모리에 보관 (demoMode 전용).
	// 연동 완료 후 이 필드를 삭제하세요.
	private demoDevRoadmap: RoadmapData | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_ROADMAP;
	}

	getDisplayText(): string {
		return "Pharos Roadmap";
	}

	getIcon(): string {
		return "calendar-range";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
		void this.loadAndRender();

		this.registerEvent(
			this.app.workspace.on("pharos:state-changed" as never, () =>
				void this.loadAndRender(),
			),
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private async loadAndRender(): Promise<void> {
		if (!this.root) return;

		// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────
		// 기획 로드맵은 mock 데이터로, 개발 로드맵은 승인 시 메모리(demoDevRoadmap)에 보관.
		// 연동 완료 후 이 블록 전체(if 문 포함)를 삭제하세요.
		if (this.plugin.settings.demoMode) {
			this.root.render(
				<RoadmapView
					planning={mockRoadmapData}
					development={this.demoDevRoadmap}
					onGenerateDevelopment={
						this.demoDevRoadmap === null
							? () => void this.openDevRoadmapGenerator(mockRoadmapData)
							: undefined
					}
					onDeleteDevelopment={
						this.demoDevRoadmap !== null
							? () => { this.demoDevRoadmap = null; void this.loadAndRender(); }
							: undefined
					}
					onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
				/>,
			);
			return;
		}
		// ──────────────────────────────────────────────────────────────────────────────

		// ── [연동 후 실행되는 실서비스 흐름] ────────────────────────────────────────────
		// demoMode 블록을 삭제하면 아래 코드가 실행됩니다.
		// settings.projectReport(레거시) 대신 projectService.get()으로 프로젝트를 조회합니다.
		// ────────────────────────────────────────────────────────────────────────────────
		const project = await this.plugin.projectService.get();

		// 1. 프로젝트 없음
		if (!project) {
			this.root.render(
				<RoadmapEmptyView
					onBackToDashboard={() =>
						void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)
					}
				/>,
			);
			return;
		}

		// project.start는 기획 로드맵 첫 phase 시작일로 채운다.
		// 아직 planningEntity가 없을 수도 있으므로 아래에서 실제 값으로 재설정.
		const projectInfo = {
			name: project.name,
			start: "",
			end: project.deadline,
		};

		// 로드맵 엔티티 조회
		const [planningEntity, developmentEntity, tasks] = await Promise.all([
			this.plugin.roadmapService.getPlanning(),
			this.plugin.roadmapService.getDevelopment(),
			this.plugin.taskService.list(),
		]);

		// 2. 기획 로드맵 미생성
		if (!planningEntity) {
			this.root.render(
				<RoadmapGenerateView
					kind="planning"
					onGenerate={() => void this.handleGeneratePlanning()}
					onBackToHome={() =>
						void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)
					}
				/>,
			);
			return;
		}

		// task.phase로 기획/개발 분리 (§4.4 설계 기준)
		const toRoadmapTask = (t: (typeof tasks)[number]) => ({
			id: t.id,
			name: t.title,
			kind: "task" as const,
			status: t.status === "done" ? "done" : t.status === "in-progress" ? "in-progress" : "todo",
			start: t.startDate,
			end: t.endDate,
			progress: t.status === "done" ? 100 : t.status === "in-progress" ? 50 : 0,
			assignee: t.assignee?.id ?? undefined,
			dependsOn: t.dependsOn,
			sourceMeetings: t.sourceMeetings,
		} satisfies RoadmapData["tasks"][number]);

		const planTasks = tasks.filter((t) => t.phase === "PLANNING").map(toRoadmapTask);

		// project.start = 기획 로드맵 첫 phase 시작일
		projectInfo.start = planningEntity.phases[0]?.start ?? "";

		// 3/4. 로드맵 렌더링
		const planning = roadmapToData(planningEntity, projectInfo, planTasks);
		// 개발 로드맵 task = task.phase === "DEVELOPMENT" (§4.4 설계 기준)
		const devTasks = tasks.filter((t) => t.phase === "DEVELOPMENT").map(toRoadmapTask);

		const development = developmentEntity
			? roadmapToData(developmentEntity, projectInfo, devTasks)
			: null;

		this.root.render(
			<RoadmapView
				planning={planning}
				development={development}
				onGenerateDevelopment={
					development === null
						? () => void this.openDevRoadmapGenerator(planning)
						: undefined
				}
				onDeleteDevelopment={
					development !== null
						? () => void this.deleteDevelopmentRoadmap()
						: undefined
				}
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
			/>,
		);
	}

	/**
	 * PO-1 기획 로드맵 생성 — 2.5초 가짜 로딩 후 service 저장.
	 *
	 * 실제 프로젝트의 시작일(오늘)·마감일을 기반으로 4개 기획 단계 계산.
	 * 시나리오.md PO-1: "착수·요구사항·디자인 등을 phase로 자동 분할"
	 * AI 연동 시: buildPlanningPhases 호출부를 llmClient.generatePlanningRoadmap(project)로 교체.
	 */
	private async handleGeneratePlanning(): Promise<void> {
		const project = await this.plugin.projectService.get();
		if (!project || !this.root) return;

		this.root.render(
			<RoadmapGenerateView
				kind="planning"
				loading
				onGenerate={() => {}}
			/>,
		);
		await sleep(2500);

		const startIso = new Date().toISOString().slice(0, 10);
		const input: RoadmapInput = {
			roadmapKind: "planning",
			phases: buildPlanningPhases(startIso, project.deadline),
		};
		await this.plugin.roadmapService.savePlanning(input);
		// savePlanning → eventBus "roadmap:planning-generated" → pharos:state-changed → loadAndRender
	}

	/**
	 * PO-6 개발 로드맵 생성 — DevRoadmapGenerateModal 열고
	 * 승인 시 roadmapService.saveDevelopment() 로 저장.
	 */
	private async openDevRoadmapGenerator(planning: RoadmapData): Promise<void> {
		const project = await this.plugin.projectService.get();
		if (!project) return;

		const report: ProjectReport = {
			name: project.name,
			description: project.description,
			deadline: project.deadline,
			fixedMeetingMode: project.fixedMeetingMode,
			fixedMeetingDay: project.fixedMeetingDay,
			fixedMeetingTime: project.fixedMeetingTime,
			createdAt: project.createdAt,
		};

		const planningEndIso =
			planning.phases.find((p) => p.id === "phase-plan")?.end ??
			new Date().toISOString().slice(0, 10);

		const [memberEntities, meetingEntities] = await Promise.all([
			this.plugin.teamService.list(),
			// 시나리오.md §8 PO-2→PO-5→PO-6 흐름:
			// 기획 주간에 쌓인 회의들(topics + analysis)을 개발 로드맵 생성 입력으로 전달.
			// devRoadmapSimulator.analyzeMinutes()가 meeting.topics에서 기능을 추출하고
			// meeting.analysis.techStacks로 담당자 배정에 활용함.
			this.plugin.meetingsService.list(),
		]);

		const members = memberEntities.map((m) => ({
			id: m.id,
			name: m.name,
			email: m.email,
			role: m.role,
			permission: m.permission,
			techStacks: m.techStacks,
			isActive: m.status === "active",
			joinedAt: m.joinedAt,
			hasFilledAvailability: false,
		}));

		// Meeting(도메인 엔티티) → MeetingPageData(시뮬레이터 입력 타입) 변환
		// meetingType → type 필드명만 다르고 나머지는 동일 구조
		const meetings: MeetingPageData[] = meetingEntities.map((m) => ({
			id: m.id,
			title: m.title,
			date: m.date,
			time: m.time,
			durationMinutes: m.durationMinutes,
			type: m.meetingType,
			status: m.status,
			attendees: m.attendees,
			topics: m.topics,
			resources: m.resources,
			minutes: m.minutes,
			analysis: m.analysis,
		}));

		new DevRoadmapGenerateModal(this.app, {
			report,
			meetings,
			members,
			planningEndIso,
			onApprove: (roadmap: RoadmapData) =>
				void this.applyDevelopmentRoadmap(roadmap),
		}).open();
	}

	private async applyDevelopmentRoadmap(roadmap: RoadmapData): Promise<void> {
		// ── [DEMO] demoMode에서는 서비스 저장 없이 메모리에 보관 후 즉시 재렌더 ──────────
		// 연동 완료 후 이 if 블록을 삭제하세요.
		if (this.plugin.settings.demoMode) {
			this.demoDevRoadmap = roadmap;
			void this.loadAndRender();
			return;
		}
		// ──────────────────────────────────────────────────────────────────────────────
		const input: RoadmapInput = {
			roadmapKind: "development",
			phases: roadmap.phases.map((p) => ({
				id: p.id,
				name: p.name,
				start: p.start,
				end: p.end,
				status: p.status === "done" ? "completed" : p.status,
				activities: p.activities,
				color: p.color,
			})),
		};
		await this.plugin.roadmapService.saveDevelopment(input);
		// saveDevelopment → eventBus → pharos:state-changed → loadAndRender
	}

	/** 테스트 전용 — 개발 로드맵 삭제 후 🔒 잠금 상태 복귀. */
	private async deleteDevelopmentRoadmap(): Promise<void> {
		await this.plugin.roadmapService.deleteDevelopment();
		// deleteDevelopment → eventBus → pharos:state-changed → loadAndRender
	}

	private async openView(viewType: string): Promise<void> {
		const { workspace } = this.app;
		const [existing] = workspace.getLeavesOfType(viewType);
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({ type: viewType, active: true });
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 프로젝트 실제 기간 기반 기획 로드맵 phase 생성 (PO-1 시뮬레이터).
 *
 * 시나리오.md PO-1: "착수·요구사항·디자인 등을 phase로 자동 분할"
 * AI 연동 전까지 실 프로젝트 날짜로 균등 분할.
 * AI 연동 시 이 함수 대신 llmClient 결과로 교체.
 */
function buildPlanningPhases(startIso: string, endIso: string): RoadmapInput["phases"] {
	const start = new Date(startIso + "T00:00:00").getTime();
	const end   = new Date(endIso   + "T00:00:00").getTime();
	const at = (frac: number) =>
		new Date(start + (end - start) * frac).toISOString().slice(0, 10);

	return [
		{
			id: "phase-kickoff",
			name: "착수",
			start: at(0),
			end: at(0.2),
			status: "todo",
			activities: ["팀 구성", "목표 설정", "일정 수립"],
			color: "#6366f1",
		},
		{
			id: "phase-requirements",
			name: "요구사항 분석",
			start: at(0.15),
			end: at(0.45),
			status: "todo",
			activities: ["기능 정의", "기술 스택 선정", "사용자 스토리"],
			color: "#3b82f6",
		},
		{
			id: "phase-design",
			name: "설계·프로토타입",
			start: at(0.4),
			end: at(0.75),
			status: "todo",
			activities: ["UI/UX 설계", "시스템 아키텍처", "프로토타입"],
			color: "#8b5cf6",
		},
		{
			id: "phase-review",
			name: "검토·확정",
			start: at(0.7),
			end: at(1),
			status: "todo",
			activities: ["스펙 확정", "팀 리뷰", "개발 준비"],
			color: "#10b981",
		},
	];
}
