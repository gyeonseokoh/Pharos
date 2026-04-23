/**
 * DashboardItemView — DashboardView(React 컴포넌트)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * Obsidian이 "탭"이라는 단위로 화면을 띄울 때는 ItemView 클래스를 상속해야 한다.
 * 우리는 React를 쓰므로 ItemView의 DOM 컨테이너(contentEl)에 React root를 mount하는 패턴.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { DashboardView } from "./DashboardView";
import { VIEW_TYPE_PHAROS_ROADMAP } from "../../roadmap/ui/RoadmapItemView";

export const VIEW_TYPE_PHAROS_DASHBOARD = "pharos-dashboard-view";

export class DashboardItemView extends ItemView {
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_DASHBOARD;
	}

	getDisplayText(): string {
		return "Pharos Dashboard";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
		this.root.render(
			<DashboardView
				onOpenRoadmap={() => void this.openView(VIEW_TYPE_PHAROS_ROADMAP)}
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
