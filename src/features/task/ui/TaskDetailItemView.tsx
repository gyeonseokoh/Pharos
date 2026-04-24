import { ItemView, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { TaskDetailView } from "./TaskDetailView";
import { getTaskDetailMock } from "./taskDetailMock";
import { ChecklistSplitModal } from "./ChecklistSplitModal";
import { VIEW_TYPE_PHAROS_MY_TASKS } from "../../progress/ui/MyTasksItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";

export const VIEW_TYPE_PHAROS_TASK_DETAIL = "pharos-task-detail-view";

interface TaskDetailViewState {
	taskId: string;
}

export class TaskDetailItemView extends ItemView {
	private root: Root | null = null;
	private taskId: string | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_TASK_DETAIL;
	}

	getDisplayText(): string {
		if (!this.taskId) return "Task 상세";
		const data = getTaskDetailMock(this.taskId);
		return data ? `${data.id} ${data.title}` : "Task 상세";
	}

	getIcon(): string {
		return "check-square";
	}

	async onOpen(): Promise<void> {
		this.ensureRoot();
		this.render();
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const s = state as TaskDetailViewState | undefined;
		if (s?.taskId) {
			this.taskId = s.taskId;
			this.ensureRoot();
			this.render();
		}
		return super.setState(state, result);
	}

	getState(): Record<string, unknown> {
		return { taskId: this.taskId };
	}

	private ensureRoot(): void {
		if (this.root) return;
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
	}

	private render(): void {
		if (!this.root) return;
		if (!this.taskId) {
			this.root.render(<Empty text="Task ID가 지정되지 않았습니다." />);
			return;
		}
		const data = getTaskDetailMock(this.taskId);
		if (!data) {
			this.root.render(<Empty text={`${this.taskId}를 찾을 수 없습니다.`} />);
			return;
		}
		this.root.render(
			<TaskDetailView
				data={data}
				onGenerateChecklist={() =>
					new ChecklistSplitModal(this.app, data.title).open()
				}
				onBackToMyTasks={() => void this.openView(VIEW_TYPE_PHAROS_MY_TASKS)}
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
}

function Empty({ text }: { text: string }) {
	return (
		<div className="pharos-root flex min-h-full w-full items-center justify-center p-6">
			<p className="text-sm text-text-muted">{text}</p>
		</div>
	);
}
