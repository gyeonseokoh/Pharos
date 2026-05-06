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
import {
	getDevelopmentRoadmap,
	getPlanningRoadmap,
} from "./mock";
import { DevRoadmapGenerateModal } from "./DevRoadmapGenerateModal";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import type { PharosPluginLike } from "../../../app/settings";
import type { RoadmapData } from "../domain/roadmapData";

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
		this.render();

		this.registerEvent(
			this.app.workspace.on("pharos:state-changed" as never, () =>
				this.render(),
			),
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private render(): void {
		if (!this.root) return;
		const {
			projectReport,
			planningRoadmapGenerated,
			developmentRoadmapGenerated,
		} = this.plugin.settings;

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

		// 2. 기획 로드맵 미생성
		if (!planningRoadmapGenerated) {
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

		// 3/4. 로드맵 존재 — 탭 2개 있는 정상 RoadmapView
		const planning = getPlanningRoadmap(projectReport);
		// 승인 저장된 개발 로드맵이 있으면 그것, 없으면 mock fallback
		const development = developmentRoadmapGenerated
			? (this.plugin.settings.developmentRoadmap ??
				getDevelopmentRoadmap(projectReport))
			: null;

		this.root.render(
			<RoadmapView
				planning={planning}
				development={development}
				onGenerateDevelopment={
					development === null
						? () => this.openDevRoadmapGenerator()
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

	/** PO-1 기획 로드맵 생성 — 지금은 2.5초 가짜 로딩 후 플래그만 true. */
	private async handleGeneratePlanning(): Promise<void> {
		// 로딩 중 상태 표시
		if (this.root) {
			this.root.render(
				<RoadmapGenerateView
					kind="planning"
					loading
					onGenerate={() => {}}
				/>,
			);
		}
		await sleep(2500);
		this.plugin.settings.planningRoadmapGenerated = true;
		await this.plugin.saveSettings();
		// saveSettings가 pharos:state-changed 트리거 → render() 재실행됨
	}

	/**
	 * PO-6 개발 로드맵 생성 — DevRoadmapGenerateModal 열고
	 * 승인 시 settings.developmentRoadmap 에 저장.
	 * TeamService에서 실제 팀원 목록을 가져와 시뮬레이터에 전달.
	 */
	private async openDevRoadmapGenerator(): Promise<void> {
		const { projectReport } = this.plugin.settings;
		if (!projectReport) return;

		const planning = getPlanningRoadmap(projectReport);
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
			meetings: [], // AI 연동 시 meetingsService → MeetingPageData 변환 예정
			members,
			planningEndIso,
			onApprove: (roadmap: RoadmapData) =>
				this.applyDevelopmentRoadmap(roadmap),
		}).open();
	}

	/**
	 * 테스트 전용 — 개발 로드맵을 삭제하고 🔒 잠금 상태로 복귀.
	 * 기획 로드맵 · 프로젝트 보고서는 그대로 유지.
	 */
	private async deleteDevelopmentRoadmap(): Promise<void> {
		this.plugin.settings.developmentRoadmap = null;
		this.plugin.settings.developmentRoadmapGenerated = false;
		await this.plugin.saveSettings();
	}

	private async applyDevelopmentRoadmap(
		roadmap: RoadmapData,
	): Promise<void> {
		this.plugin.settings.developmentRoadmap = roadmap;
		this.plugin.settings.developmentRoadmapGenerated = true;
		await this.plugin.saveSettings();
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
