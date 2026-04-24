/**
 * MyTasksItemView — MyTasksView(개인 타임라인 + 체크리스트)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * 오늘: mockMyTasksData 주입. 체크박스는 View 내부 state로 토글만 (저장 안 됨).
 * 미래: taskService.getMine() 결과 주입 + onToggleCheck 콜백으로 checklistService 호출.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { MyTasksView } from "./MyTasksView";
import { mockMyTasksData } from "./myTasksMock";
import { VIEW_TYPE_PHAROS_TASK_DETAIL } from "../../task/ui/TaskDetailItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "./DashboardItemView";
import type { PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_MY_TASKS = "pharos-my-tasks-view";

export class MyTasksItemView extends ItemView {
	private root: Root | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
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
					viewName="내 업무"
					onOpenDashboard={() =>
						void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)
					}
				/>,
			);
			return;
		}
		this.root.render(
			<MyTasksView
				data={mockMyTasksData}
				onOpenTaskDetail={(taskId) => void this.openTaskDetail(taskId)}
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
			/>,
		);
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

	private async openTaskDetail(taskId: string): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace
			.getLeavesOfType(VIEW_TYPE_PHAROS_TASK_DETAIL)
			.find((leaf) => {
				const s = leaf.getViewState().state as
					| { taskId?: string }
					| undefined;
				return s?.taskId === taskId;
			});
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_PHAROS_TASK_DETAIL,
			state: { taskId },
			active: true,
		});
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}
}
