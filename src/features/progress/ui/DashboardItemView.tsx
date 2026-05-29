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

import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { DashboardView } from "./DashboardView";
import { EmptyDashboardView } from "./EmptyDashboardView";
import { VIEW_TYPE_PHAROS_MY_TASKS } from "./MyTasksItemView";
import { VIEW_TYPE_PHAROS_PROGRESS } from "./ProgressPageItemView";
import { VIEW_TYPE_PHAROS_CALENDAR } from "../../meeting/ui/CalendarItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "../../meeting/ui/MeetingsListItemView";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "../../meeting/ui/MeetingPageItemView";
import { AiTopicModal } from "../../meeting/ui/AiTopicModal";
import { NewProjectModal } from "../../project/ui/NewProjectModal";
import { ProjectSettingsModal } from "../../project/ui/ProjectSettingsModal";
// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────────
// 연동 완료 후 이 import 줄을 삭제하세요.
import { mockDashboardData } from "./mock";
// ──────────────────────────────────────────────────────────────────────────────
import { VIEW_TYPE_PHAROS_ROADMAP } from "../../roadmap/ui/RoadmapItemView";
import { VIEW_TYPE_PHAROS_TEAM_LIST } from "../../team/ui/TeamListItemView";
import type { PharosPluginLike } from "../../../app/settings";
import type { Project } from "../../project/domain/projectSchema";
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
			this.app.workspace.on(
				"pharos:state-changed" as never,
				() => void this.loadAndRender(),
			),
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private async loadAndRender(): Promise<void> {
		if (!this.root) return;

		const project = await this.plugin.projectService.get();

		if (!project) {
			this.root.render(
				<EmptyDashboardView
					onCreateProject={() =>
						new NewProjectModal(this.app, this.plugin).open()
					}
				/>,
			);
			return;
		}

		// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────
		// 프로젝트 생성 후 실서비스 대신 mock 데이터로 대시보드를 렌더합니다.
		// 연동 완료 후 이 블록 전체(if 문 포함)를 삭제하세요.
		if (this.plugin.settings.demoMode) {
			this.root.render(
				<DashboardView
					data={mockDashboardData}
					onOpenRoadmap={() => void this.openView(VIEW_TYPE_PHAROS_ROADMAP)}
					onOpenMeetings={() => void this.openView(VIEW_TYPE_PHAROS_MEETINGS_LIST)}
					onOpenMeeting={(id) => void this.openMeeting(id)}
					onOpenProgress={() => void this.openView(VIEW_TYPE_PHAROS_PROGRESS)}
					onOpenMyTasks={() => void this.openView(VIEW_TYPE_PHAROS_MY_TASKS)}
					onOpenCalendar={() => void this.openView(VIEW_TYPE_PHAROS_CALENDAR)}
					onOpenTeam={() => void this.openView(VIEW_TYPE_PHAROS_TEAM_LIST)}
					onGenerateMeetingTopics={() => {
						// demoMode에서도 실제 다음 회의를 찾아 meetingId 전달
						// 회의가 없으면 안내 Notice (회의 페이지에서도 동일 기능 사용 가능)
						void this.plugin.meetingsService.list().then((meetings) => {
							const today = new Date().toISOString().slice(0, 10);
							const next = meetings
								.filter((m) => m.date >= today && m.status !== "completed")
								.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0];
							if (!next) {
								new Notice("주제를 추가할 다음 회의가 없습니다. 먼저 회의를 생성해주세요.");
								return;
							}
							new AiTopicModal(this.app, this.plugin, next.id).open();
						});
					}}
					onOpenSettings={() =>
						// plugin을 전달해 Modal이 projectService.update()를 호출할 수 있게 함
						new ProjectSettingsModal(this.app, this.plugin, {
							topic: project.name,
							description: project.description,
							deadline: project.deadline,
						}).open()
					}
				/>,
			);
			return;
		}
		// ──────────────────────────────────────────────────────────────────────────────

		const data = await this.buildDashboardData(project);
		this.root.render(
			<DashboardView
				data={data}
				onOpenRoadmap={() =>
					void this.openView(VIEW_TYPE_PHAROS_ROADMAP)
				}
				onOpenMeetings={() =>
					void this.openView(VIEW_TYPE_PHAROS_MEETINGS_LIST)
				}
				onOpenMeeting={(id) => void this.openMeeting(id)}
				onOpenProgress={() =>
					void this.openView(VIEW_TYPE_PHAROS_PROGRESS)
				}
				onOpenMyTasks={() =>
					void this.openView(VIEW_TYPE_PHAROS_MY_TASKS)
				}
				onOpenCalendar={() =>
					void this.openView(VIEW_TYPE_PHAROS_CALENDAR)
				}
				onOpenTeam={() =>
					void this.openView(VIEW_TYPE_PHAROS_TEAM_LIST)
				}
				onGenerateMeetingTopics={() => {
					// data.meetings는 buildDashboardData()에서 이미 정렬된 다음 회의 목록
					// 가장 가까운 회의에 주제 추가 — 회의가 없으면 안내
					const nextId = data.meetings[0]?.id;
					if (!nextId) {
						new Notice("주제를 추가할 다음 회의가 없습니다. 먼저 회의를 생성해주세요.");
						return;
					}
					new AiTopicModal(this.app, this.plugin, nextId).open();
				}}
				onOpenSettings={() =>
					// plugin을 전달해 Modal이 projectService.update()를 호출할 수 있게 함
					new ProjectSettingsModal(this.app, this.plugin, {
						topic: project.name,
						description: project.description,
						deadline: project.deadline,
					}).open()
				}
			/>,
		);
	}

	private async buildDashboardData(project: Project): Promise<DashboardData> {
		const today = new Date().toISOString().slice(0, 10);
		const deadlineDate = new Date(project.deadline + "T00:00:00");
		const todayDate = new Date();
		todayDate.setHours(0, 0, 0, 0);
		const daysLeft = Math.max(
			0,
			Math.round(
				(deadlineDate.getTime() - todayDate.getTime()) /
					(1000 * 60 * 60 * 24),
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
					a.date.localeCompare(b.date) ||
					a.time.localeCompare(b.time),
			)
			.slice(0, 3)
			.map((m) => ({ id: m.id, date: m.date, time: m.time, title: m.title }));

		const alerts: DashboardAlert[] = [];
		if (taskSummary.blocked > 0) {
			alerts.push({
				severity: "warning",
				text: `블로커 Task ${taskSummary.blocked}건이 있습니다.`,
			});
		}
		if (
			!project.planningRoadmapGenerated &&
			!project.developmentRoadmapGenerated
		) {
			alerts.push({
				severity: "info",
				text: "기획 로드맵이 아직 없습니다. Roadmap 탭에서 생성해주세요.",
			});
		}

		return {
			project: {
				name: project.name,
				deadline: project.deadline,
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
				memberName:
					members.find((m) => m.status === "active")?.name ?? "나",
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
				{ label: "최종 마감", date: project.deadline, dday: daysLeft },
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

	/**
	 * 특정 회의 페이지로 이동.
	 * MeetingPageItemView·setState({ meetingId, source }) 패턴은 캘린더·회의 목록·
	 * 회의록 관리에서 이미 동일하게 사용 중이므로 새 인프라 추가 없이 재사용한 것.
	 * source를 "meetings-list"로 고정해 회의 페이지의 뒤로가기가 회의 목록으로 돌아가도록 한다.
	 * 실서비스 연동 시에도 buildDashboardData가 meetingsService.list()의 id를 그대로
	 * 전달하므로 이 메서드는 수정 없이 동작한다.
	 */
	private async openMeeting(meetingId: string): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace
			.getLeavesOfType(VIEW_TYPE_PHAROS_MEETING_PAGE)
			.find((leaf) => {
				const s = leaf.getViewState().state as { meetingId?: string } | undefined;
				return s?.meetingId === meetingId;
			});
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_PHAROS_MEETING_PAGE,
			state: { meetingId, source: "meetings-list" },
			active: true,
		});
	}
}
