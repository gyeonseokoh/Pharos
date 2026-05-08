/**
 * DashboardItemView — DashboardView(React 컴포넌트)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * 상태별 분기:
 *   1) projectReport === null              → 빈 Dashboard + "프로젝트 생성" CTA
 *   2) 프로젝트 있음 (로드맵 유무 무관)    → 실데이터 렌더
 *      - progressService.getTaskSummary()
 *      - meetingsService.list()  (다가오는 회의)
 *      - teamService.list()      (팀원 활동)
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { DashboardView } from "./DashboardView";
import { EmptyDashboardView } from "./EmptyDashboardView";
import { VIEW_TYPE_PHAROS_MY_TASKS } from "./MyTasksItemView";
import { VIEW_TYPE_PHAROS_PROGRESS } from "./ProgressPageItemView";
import { VIEW_TYPE_PHAROS_CALENDAR } from "../../meeting/ui/CalendarItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "../../meeting/ui/MeetingsListItemView";
import { AiTopicModal } from "../../meeting/ui/AiTopicModal";
import { NewProjectModal } from "../../project/ui/NewProjectModal";
import { ProjectSettingsModal } from "../../project/ui/ProjectSettingsModal";
import { VIEW_TYPE_PHAROS_ROADMAP } from "../../roadmap/ui/RoadmapItemView";
import { VIEW_TYPE_PHAROS_TEAM_LIST } from "../../team/ui/TeamListItemView";
import type { PharosPluginLike, ProjectReport } from "../../../app/settings";
import type { DashboardData, DashboardAlert } from "../domain/dashboardData";

export const VIEW_TYPE_PHAROS_DASHBOARD = "pharos-dashboard-view";

export class DashboardItemView extends ItemView {
	private root: Root | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
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
		if (!this.root) return;
		const { projectReport } = this.plugin.settings;

		if (!projectReport) {
			this.root.render(
				<EmptyDashboardView
					onCreateProject={() =>
						new NewProjectModal(
							this.app,
							this.plugin.projectService,
						).open()
					}
				/>,
			);
			return;
		}

		const data = await this.buildDashboardData(projectReport);
		this.root.render(
			<DashboardView
				data={data}
				onOpenRoadmap={() => void this.openView(VIEW_TYPE_PHAROS_ROADMAP)}
				onOpenMeetings={() =>
					void this.openView(VIEW_TYPE_PHAROS_MEETINGS_LIST)
				}
				onOpenProgress={() => void this.openView(VIEW_TYPE_PHAROS_PROGRESS)}
				onOpenMyTasks={() => void this.openView(VIEW_TYPE_PHAROS_MY_TASKS)}
				onOpenCalendar={() => void this.openView(VIEW_TYPE_PHAROS_CALENDAR)}
				onOpenTeam={() => void this.openView(VIEW_TYPE_PHAROS_TEAM_LIST)}
				onGenerateMeetingTopics={() => new AiTopicModal(this.app).open()}
				onOpenSettings={() =>
					new ProjectSettingsModal(this.app, {
						topic: projectReport.name,
						description: projectReport.description,
						deadline: projectReport.deadline,
					}).open()
				}
			/>,
		);
	}

	private async buildDashboardData(
		projectReport: ProjectReport,
	): Promise<DashboardData> {
		const today = new Date().toISOString().slice(0, 10);
		const deadlineDate = new Date(projectReport.deadline + "T00:00:00");
		const todayDate = new Date();
		todayDate.setHours(0, 0, 0, 0);
		const daysLeft = Math.max(
			0,
			Math.round(
				(deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
			),
		);

		const [taskSummary, meetings, members] = await Promise.all([
			this.plugin.progressService.getTaskSummary(),
			this.plugin.meetingsService.list(),
			this.plugin.teamService.list(),
		]);

		const upcomingMeetings = meetings
			.filter((m) => m.date >= today && m.status !== "completed")
			.sort(
				(a, b) =>
					a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
			)
			.slice(0, 3)
			.map((m) => ({ date: m.date, time: m.time, title: m.title }));

		const alerts: DashboardAlert[] = [];
		if (taskSummary.blocked > 0) {
			alerts.push({
				severity: "warning",
				text: `블로커 Task ${taskSummary.blocked}건이 있습니다.`,
			});
		}
		if (
			!this.plugin.settings.planningRoadmapGenerated &&
			!this.plugin.settings.developmentRoadmapGenerated
		) {
			alerts.push({
				severity: "info",
				text: "기획 로드맵이 아직 없습니다. Roadmap 탭에서 생성해주세요.",
			});
		}

		return {
			project: {
				name: projectReport.name,
				deadline: projectReport.deadline,
				daysUntilPrototype: null,
				totalDays: daysLeft,
			},
			progress: {
				totalTasks: taskSummary.total,
				completedTasks: taskSummary.done,
				thisWeekCommits: 0,
			},
			prototypeProgress: null,
			developmentProgress: {
				percent: taskSummary.completionRate,
				dday: daysLeft,
			},
			myTasks: {
				inProgress: taskSummary.inProgress,
				total: taskSummary.total,
				memberName: members.find((m) => m.status === "active")?.name ?? "나",
			},
			members: members.map((m) => ({
				id: m.id,
				name: m.name,
				role: m.role,
				checks: 0,
				commits: 0,
			})),
			meetings: upcomingMeetings,
			importantDates: [
				{ label: "최종 마감", date: projectReport.deadline, dday: daysLeft },
			],
			alerts,
		};
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
