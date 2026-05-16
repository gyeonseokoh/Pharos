/**
 * ProgressPageItemView — ProgressPageView(공개 진행도 페이지)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * progressService + teamService + commitService 실데이터 주입.
 * 팀원별 Task 통계 + 체크리스트 체크 이벤트 + 커밋 이벤트를 집계해 렌더.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { ProgressPageView } from "./ProgressPageView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "./DashboardItemView";
import type { ProgressPageData, MemberProgressDetail, ActivityItem } from "../domain/progressPageData";
import type { PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_PROGRESS = "pharos-progress-page-view";

/** ISO 주의 월요일 날짜 반환 (YYYY-MM-DD). */
function getWeekStart(today: string): string {
	const d = new Date(today + "T00:00:00");
	const day = d.getDay(); // 0=일
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	return d.toISOString().slice(0, 10);
}

export class ProgressPageItemView extends ItemView {
	private root: Root | null = null;
	private progressData: ProgressPageData | null = null;

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
		const { projectReport } = this.plugin.settings;
		if (!projectReport) {
			this.progressData = null;
			this.render();
			return;
		}

		const today = new Date().toISOString().slice(0, 10);
		const weekStart = getWeekStart(today);
		const currentMonth = today.slice(0, 7);

		const [tasks, members, commits] = await Promise.all([
			this.plugin.taskService.list(),
			this.plugin.teamService.list(),
			this.plugin.commitService.listByMonth(currentMonth),
		]);

		const memberDetails: MemberProgressDetail[] = members.map((member) => {
			const memberTasks = tasks.filter((t) => t.assignee?.id === member.id);

			// 체크리스트 체크 이벤트 구성
			const checkActivities: ActivityItem[] = [];
			for (const task of memberTasks) {
				for (const item of task.checklist ?? []) {
					if (!item.checked || !item.checkedAt) continue;
					checkActivities.push({
						type: "check",
						timestamp: item.checkedAt,
						taskId: task.id,
						taskTitle: task.title,
						itemText: item.text,
					});
				}
			}

			// 커밋 이벤트 구성 (author 이름 매칭)
			const commitActivities: ActivityItem[] = commits
				.filter((c) => c.author === member.name)
				.map((c) => ({
					type: "commit",
					timestamp: c.date,
					sha: c.sha,
					message: c.message,
					taskId: c.taskId,
					filesChanged: c.filesChanged,
					linesAdded: c.linesAdded,
					linesRemoved: c.linesRemoved,
				}));

			const checksToday = checkActivities.filter((a) =>
				a.timestamp.startsWith(today),
			).length;
			const commitsToday = commitActivities.filter((a) =>
				a.timestamp.startsWith(today),
			).length;
			const checksThisWeek = checkActivities.filter(
				(a) => a.timestamp.slice(0, 10) >= weekStart,
			).length;
			const commitsThisWeek = commitActivities.filter(
				(a) => a.timestamp.slice(0, 10) >= weekStart,
			).length;

			const recentActivity = [...checkActivities, ...commitActivities]
				.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
				.slice(0, 10);

			return {
				id: member.id,
				name: member.name,
				role: member.role,
				stats: { checksToday, commitsToday, checksThisWeek, commitsThisWeek },
				recentActivity,
				narrative: null,
			};
		});

		const totalChecks = memberDetails.reduce(
			(s, m) => s + m.stats.checksToday,
			0,
		);
		const totalCommits = memberDetails.reduce(
			(s, m) => s + m.stats.commitsToday,
			0,
		);
		const activeMembers = memberDetails.filter(
			(m) => m.stats.checksToday > 0 || m.stats.commitsToday > 0,
		).length;

		this.progressData = {
			projectName: projectReport.name,
			lastUpdated: new Date().toISOString(),
			period: { start: today, end: today, label: "오늘" },
			team: {
				totalChecks,
				totalCommits,
				activeMembers,
				totalMembers: members.length,
			},
			members: memberDetails,
		};

		this.render();
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
		if (!this.progressData) return;

		this.root.render(
			<ProgressPageView
				data={this.progressData}
				onRefresh={() => void this.loadAndRender()}
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
