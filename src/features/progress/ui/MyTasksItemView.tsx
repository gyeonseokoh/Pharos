/**
 * MyTasksItemView — MyTasksView(개인 타임라인 + 체크리스트)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * 오늘: mockMyTasksData 주입. 체크박스는 View 내부 state로 토글만 (저장 안 됨).
 * 미래: taskService.getMine() 결과 주입 + onToggleCheck 콜백으로 checklistService 호출.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { MyTasksView } from "./MyTasksView";
import { mockMyTasksData } from "./myTasksMock";

export const VIEW_TYPE_PHAROS_MY_TASKS = "pharos-my-tasks-view";

export class MyTasksItemView extends ItemView {
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_MY_TASKS;
	}

	getDisplayText(): string {
		return "내 업무";
	}

	getIcon(): string {
		return "list-checks";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
		this.root.render(<MyTasksView data={mockMyTasksData} />);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}
}
