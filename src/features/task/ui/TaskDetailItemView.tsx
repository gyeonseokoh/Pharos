import { ItemView, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { TaskDetailView } from "./TaskDetailView";
import { ChecklistSplitModal } from "./ChecklistSplitModal";
import { VIEW_TYPE_PHAROS_MY_TASKS } from "../../progress/ui/MyTasksItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "../../meeting/ui/MeetingPageItemView";
import type { PharosPluginLike } from "../../../app/settings";
import type { TaskDetailData } from "../domain/taskDetailData";

export const VIEW_TYPE_PHAROS_TASK_DETAIL = "pharos-task-detail-view";

interface TaskDetailViewState {
	taskId: string;
}

export class TaskDetailItemView extends ItemView {
	private root: Root | null = null;
	private taskId: string | null = null;
	private taskData: TaskDetailData | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_TASK_DETAIL;
	}

	getDisplayText(): string {
		if (!this.taskId) return "Task 상세";
		if (this.taskData) return `${this.taskData.id} ${this.taskData.title}`;
		return this.taskId;
	}

	getIcon(): string {
		return "check-square";
	}

	async onOpen(): Promise<void> {
		this.ensureRoot();
		await this.loadAndRender();
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
			await this.loadAndRender();
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

	private async loadAndRender(): Promise<void> {
		if (!this.taskId) {
			this.render();
			return;
		}
		const task = await this.plugin.taskService.getById(this.taskId);
		if (!task) {
			this.taskData = null;
			this.render();
			return;
		}
		const [checklist, assignee] = await Promise.all([
			this.plugin.taskService.listChecklist(this.taskId),
			task.assignee?.id
				? this.plugin.teamService.getById(task.assignee.id)
				: Promise.resolve(null),
		]);
		this.taskData = {
			id: task.id,
			title: task.title,
			description: task.description,
			startDate: task.startDate,
			endDate: task.endDate,
			status: task.status === "blocked" ? "todo" : task.status,
			priority: task.priority,
			phase: task.phase,
			assignee: assignee
				? { id: assignee.id, name: assignee.name, role: assignee.role }
				: null,
			dependsOn: task.dependsOn.map((id) => ({ id, title: id })),
			checklist: checklist.map((c) => ({
				id: c.id,
				text: c.text,
				checked: c.checked,
				checkedAt: c.checkedAt,
				checkedBy: c.checkedBy,
			})),
			linkedCommits: [],
			sourceMeetings: [],
		};
		this.render();
	}

	private render(): void {
		if (!this.root) return;
		if (!this.taskId) {
			this.root.render(<Empty text="Task ID가 지정되지 않았습니다." />);
			return;
		}
		if (!this.taskData) {
			this.root.render(<Empty text={`${this.taskId}를 찾을 수 없습니다.`} />);
			return;
		}
		this.root.render(
			<TaskDetailView
				data={this.taskData}
				onGenerateChecklist={() =>
					new ChecklistSplitModal(this.app, this.taskData!.title).open()
				}
				onBackToMyTasks={() => void this.openView(VIEW_TYPE_PHAROS_MY_TASKS)}
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
				onOpenSourceMeeting={(meetingId) =>
					void this.openMeetingPage(meetingId)
				}
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

	private async openMeetingPage(meetingId: string): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace
			.getLeavesOfType(VIEW_TYPE_PHAROS_MEETING_PAGE)
			.find((leaf) => {
				const s = leaf.getViewState().state as
					| { meetingId?: string }
					| undefined;
				return s?.meetingId === meetingId;
			});
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_PHAROS_MEETING_PAGE,
			state: { meetingId },
			active: true,
		});
	}
}

function Empty({ text }: { text: string }) {
	return (
		<div className="pharos-root flex min-h-full w-full items-center justify-center p-6">
			<p className="text-sm text-text-muted">{text}</p>
		</div>
	);
}
