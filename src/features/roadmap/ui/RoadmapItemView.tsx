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
import type { PharosPluginLike } from "../../../app/settings";
import type { RoadmapData } from "../domain/roadmapData";
import type { RoadmapInput } from "../domain/roadmapSchema";

export const VIEW_TYPE_PHAROS_ROADMAP = "pharos-roadmap-view";

export class RoadmapItemView extends ItemView {
	private root: Root | null = null;

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
		const { projectReport } = this.plugin.settings;

		// 1. 프로젝트 없음
		if (!projectReport) {
			this.root.render(
				<RoadmapEmptyView
					onBackToDashboard={() =>
						void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)
					}
				/>,
			);
			return;
		}

		// project.start는 기획 로드맵 첫 phase 시작일로 채운다 (ProjectReport에 없음).
		// 아직 planningEntity가 없을 수도 있으므로 아래에서 실제 값으로 재설정.
		const projectInfo = {
			name: projectReport.name,
			start: "",
			end: projectReport.deadline,
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
			assignee: t.assigneeId ?? undefined,
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

	/** PO-1 기획 로드맵 생성 — 2.5초 가짜 로딩 후 service 저장. */
	private async handleGeneratePlanning(): Promise<void> {
		const { projectReport } = this.plugin.settings;
		if (!projectReport || !this.root) return;

		this.root.render(
			<RoadmapGenerateView
				kind="planning"
				loading
				onGenerate={() => {}}
			/>,
		);
		await sleep(2500);

		// mock 데이터로 기획 로드맵 구성 (AI 연동 전 임시)
		const { mockRoadmapData } = await import("./mock");
		const input: RoadmapInput = {
			roadmapKind: "planning",
			phases: mockRoadmapData.phases.map((p) => ({
				id: p.id,
				name: p.name,
				start: p.start,
				end: p.end,
				status: p.status === "done" ? "completed" : p.status,
				activities: p.activities,
				color: p.color,
			})),
		};
		await this.plugin.roadmapService.savePlanning(input);
		// savePlanning → eventBus "roadmap:planning-generated" → pharos:state-changed → loadAndRender
	}

	/**
	 * PO-6 개발 로드맵 생성 — DevRoadmapGenerateModal 열고
	 * 승인 시 roadmapService.saveDevelopment() 로 저장.
	 */
	private async openDevRoadmapGenerator(planning: RoadmapData): Promise<void> {
		const { projectReport } = this.plugin.settings;
		if (!projectReport) return;

		const planningEndIso =
			planning.phases.find((p) => p.id === "phase-plan")?.end ??
			new Date().toISOString().slice(0, 10);

		const memberEntities = await this.plugin.teamService.list();
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

		new DevRoadmapGenerateModal(this.app, {
			report: projectReport,
			meetings: [],
			members,
			planningEndIso,
			onApprove: (roadmap: RoadmapData) =>
				void this.applyDevelopmentRoadmap(roadmap),
		}).open();
	}

	private async applyDevelopmentRoadmap(roadmap: RoadmapData): Promise<void> {
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
