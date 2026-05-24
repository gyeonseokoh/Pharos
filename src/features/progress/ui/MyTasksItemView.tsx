/**
 * MyTasksItemView — MyTasksView(개인 타임라인 + 체크리스트)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * taskService.list() + teamService.list() 실데이터 주입.
 * 현재 사용자 식별자가 없으므로 팀의 첫 번째 활성 멤버 기준으로 렌더.
 * (추후 settings.currentMemberId 추가 시 필터 교체 가능)
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { MyTasksView } from "./MyTasksView";
import { VIEW_TYPE_PHAROS_TASK_DETAIL } from "../../task/ui/TaskDetailItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "./DashboardItemView";
// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────────
// 연동 완료 후 이 import 줄을 삭제하세요.
import { mockMyTasksData } from "./myTasksMock";
// ──────────────────────────────────────────────────────────────────────────────
import type { MyTasksData, MyTask, MyTasksStats } from "../domain/myTasksData";
import type { PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_MY_TASKS = "pharos-my-tasks-view";

export class MyTasksItemView extends ItemView {
	private root: Root | null = null;
	private myTasksData: MyTasksData | null = null;

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
		void this.loadAndRender();

		this.registerEvent(
			this.app.workspace.on("pharos:state-changed" as never, () =>
				void this.loadAndRender(),
			),
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private async loadAndRender(): Promise<void> {
		// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────
		// 연동 완료 후 이 블록 전체(if 문 포함)를 삭제하세요.
		if (this.plugin.settings.demoMode) {
			this.myTasksData = mockMyTasksData;
			this.render();
			return;
		}
		// ──────────────────────────────────────────────────────────────────────────────

		// ── [연동 후 실행되는 실서비스 흐름] ────────────────────────────────────────────
		// demoMode 블록을 삭제하면 아래 코드가 실행됩니다.
		// settings.projectReport(레거시) 대신 projectService.get()으로 프로젝트를 확인합니다.
		// ────────────────────────────────────────────────────────────────────────────────
		const project = await this.plugin.projectService.get();
		if (!project) {
			this.root?.render(
				<ProjectRequiredEmpty
					viewName="내 업무"
					onOpenDashboard={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
				/>,
			);
			return;
		}

		const [allTasks, members] = await Promise.all([
			this.plugin.taskService.list(),
			this.plugin.teamService.list(),
		]);

		// 첫 번째 활성 멤버를 "나"로 간주 (currentMemberId 미구현)
		const me = members.find((m) => m.status === "active") ?? members[0] ?? null;

		const tasks = me
			? allTasks.filter((t) => t.assignee?.id === me.id)
			: allTasks;

		const today = new Date().toISOString().slice(0, 10);

		const myTasks: MyTask[] = tasks.map((t) => ({
			id: t.id,
			title: t.title,
			description: t.description,
			startDate: t.startDate,
			endDate: t.endDate,
			status: t.status === "blocked" ? "todo" : t.status,
			priority: t.priority,
			phase: t.phase,
			checklist: (t.checklist ?? []).map((c) => ({
				id: c.id,
				text: c.text,
				checked: c.checked,
				checkedAt: c.checkedAt,
			})),
		}));

		const totalChecklistItems = myTasks.reduce(
			(s, t) => s + t.checklist.length,
			0,
		);
		const completedChecklistItems = myTasks.reduce(
			(s, t) => s + t.checklist.filter((c) => c.checked).length,
			0,
		);

		const stats: MyTasksStats = {
			totalTasks: myTasks.length,
			inProgressTasks: myTasks.filter((t) => t.status === "in-progress").length,
			todoTasks: myTasks.filter((t) => t.status === "todo").length,
			doneTasks: myTasks.filter((t) => t.status === "done").length,
			totalChecklistItems,
			completedChecklistItems,
			dueTodayTasks: myTasks.filter((t) => t.endDate === today).length,
		};

		this.myTasksData = {
			profile: me
				? { id: me.id, name: me.name, role: me.role }
				: { id: "me", name: "나", role: "PM" },
			stats,
			tasks: myTasks,
		};

		this.render();
	}

	private render(): void {
		if (!this.root) return;
		if (!this.myTasksData) return;

		this.root.render(
			<MyTasksView
				data={this.myTasksData}
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
}
