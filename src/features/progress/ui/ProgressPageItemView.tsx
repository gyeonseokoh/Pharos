/**
 * ProgressPageItemView — ProgressPageView(공개 진행도 페이지)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * "데이터 공급책" 역할:
 *   - 오늘: `mockProgressPageData` 주입
 *   - 미래: `progressService.getTeamPage(period)` 결과 주입. 이 파일만 수정.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProgressPageView } from "./ProgressPageView";
import { mockProgressPageData } from "./progressPageMock";

export const VIEW_TYPE_PHAROS_PROGRESS = "pharos-progress-page-view";

export class ProgressPageItemView extends ItemView {
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf) {
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
		this.root.render(
			<ProgressPageView
				data={mockProgressPageData}
				onRefresh={() => {
					// MVP에서는 수동 새로고침 시 그냥 알림만.
					// 미래: progressService.refresh() 후 데이터 재로드.
				}}
			/>,
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}
}
