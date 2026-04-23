/**
 * RoadmapItemView — RoadmapView(React 컴포넌트)를 Obsidian ItemView 탭으로 감싸는 어댑터.
 *
 * 이 어댑터가 "데이터 공급책" 역할도 함:
 *   - 오늘: `mockRoadmapData`를 props로 주입
 *   - 미래: `roadmapService.generate()` 결과를 주입 (RoadmapView 자체는 무변경)
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { RoadmapView } from "./RoadmapView";
import { mockRoadmapData } from "./mock";

export const VIEW_TYPE_PHAROS_ROADMAP = "pharos-roadmap-view";

export class RoadmapItemView extends ItemView {
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf) {
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
		this.root.render(<RoadmapView data={mockRoadmapData} />);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}
}
