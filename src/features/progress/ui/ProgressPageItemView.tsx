/**
 * ProgressPageItemView — ProgressPageView(공개 진행도 페이지)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * "데이터 공급책" 역할:
 *   - 오늘: `mockProgressPageData` 주입
 *   - 미래: `progressService.getTeamPage(period)` 결과 주입. 이 파일만 수정.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { ProgressPageView } from "./ProgressPageView";
import { mockProgressPageData } from "./progressPageMock";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "./DashboardItemView";
import type { PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_PROGRESS = "pharos-progress-page-view";

export class ProgressPageItemView extends ItemView {
	private root: Root | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_PROGRESS;
	}

	getDisplayText(): string {
		return "팀 진행도";
	}

	getIcon(): string {
		return "trending-up";
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

	private render(): void {
		if (!this.root) return;
		if (!this.plugin.settings.projectReport) {
			this.root.render(
				<ProjectRequiredEmpty
					viewName="팀 진행도"
					onOpenDashboard={() =>
						void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)
					}
				/>,
			);
			return;
		}
		this.root.render(
			<ProgressPageView
				data={mockProgressPageData}
				onRefresh={() => {}}
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
			/>,
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
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
