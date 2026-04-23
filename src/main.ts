import { Plugin } from "obsidian";
import {
	DashboardItemView,
	VIEW_TYPE_PHAROS_DASHBOARD,
} from "./features/progress/ui/DashboardItemView";
import {
	RoadmapItemView,
	VIEW_TYPE_PHAROS_ROADMAP,
} from "./features/roadmap/ui/RoadmapItemView";

export default class PharosPlugin extends Plugin {
	async onload(): Promise<void> {
		// 뷰 타입 등록
		this.registerView(
			VIEW_TYPE_PHAROS_DASHBOARD,
			(leaf) => new DashboardItemView(leaf),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_ROADMAP,
			(leaf) => new RoadmapItemView(leaf),
		);

		// Ribbon 아이콘 (왼쪽 세로줄)
		this.addRibbonIcon("layout-dashboard", "Pharos Dashboard", () => {
			void this.activateView(VIEW_TYPE_PHAROS_DASHBOARD);
		});

		// 명령 팔레트 (Ctrl+P)
		this.addCommand({
			id: "open-dashboard",
			name: "Open Pharos Dashboard",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_DASHBOARD),
		});
		this.addCommand({
			id: "open-roadmap",
			name: "Open Pharos Roadmap",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_ROADMAP),
		});
	}

	async onunload(): Promise<void> {
		// 플러그인 비활성 시 열린 탭 정리 (선택)
	}

	/**
	 * 지정한 뷰 타입의 탭이 이미 있으면 포커스, 없으면 새 탭으로 오픈.
	 */
	async activateView(viewType: string): Promise<void> {
		const { workspace } = this.app;

		const [existing] = workspace.getLeavesOfType(viewType);
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}

		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: viewType,
			active: true,
		});
	}
}
