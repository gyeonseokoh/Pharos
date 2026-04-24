/**
 * DashboardItemView — DashboardView(React 컴포넌트)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * 상태별 분기 (플러그인 settings 기반):
 *   1) projectReport === null              → 빈 Dashboard + "프로젝트 생성" CTA
 *   2) 프로젝트 있음, 로드맵 아직 없음       → 프로젝트 헤더 + "로드맵 생성 필요" 안내
 *   3) 로드맵 생성됨 (기획 or 개발)         → 기존 mockDashboardData (이름·마감만 report 값으로 덮어쓰기)
 *
 * 미래: 3번 상태의 mockDashboardData 자리가 progressService.getSummary() 호출로 교체됨.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { DashboardView } from "./DashboardView";
import { EmptyDashboardView } from "./EmptyDashboardView";
import { mockDashboardData } from "./mock";
import { VIEW_TYPE_PHAROS_MY_TASKS } from "./MyTasksItemView";
import { VIEW_TYPE_PHAROS_PROGRESS } from "./ProgressPageItemView";
import { VIEW_TYPE_PHAROS_CALENDAR } from "../../meeting/ui/CalendarItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "../../meeting/ui/MeetingsListItemView";
import { AiTopicModal } from "../../meeting/ui/AiTopicModal";
import { NewProjectModal } from "../../project/ui/NewProjectModal";
import { ProjectSettingsModal } from "../../project/ui/ProjectSettingsModal";
import { VIEW_TYPE_PHAROS_ROADMAP } from "../../roadmap/ui/RoadmapItemView";
import { VIEW_TYPE_PHAROS_TEAM_LIST } from "../../team/ui/TeamListItemView";
import type {
	PharosPluginLike,
	ProjectReport,
} from "../../../app/settings";
import type { DashboardData } from "../domain/dashboardData";

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
		this.render();

		// 상태 변화 (프로젝트 생성·리셋 등) 시 자동 리렌더
		this.registerEvent(
			this.app.workspace.on("pharos:state-changed" as never, () =>
				this.render(),
			),
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private render(): void {
		if (!this.root) return;
		const {
			projectReport,
			planningRoadmapGenerated,
			developmentRoadmapGenerated,
		} = this.plugin.settings;

		// ── 1. 프로젝트 없음 ── 빈 Dashboard
		if (!projectReport) {
			this.root.render(
				<EmptyDashboardView
					onCreateProject={() =>
						new NewProjectModal(this.app, this.plugin).open()
					}
				/>,
			);
			return;
		}

		const hasRoadmap =
			planningRoadmapGenerated || developmentRoadmapGenerated;

		// ── 2. 프로젝트 있음, 로드맵 없음 ── 최소 정보 + 안내 알림
		// ── 3. 로드맵 생성됨 ── 전체 mock (이름·마감 덮어쓰기)
		const data = hasRoadmap
			? overlayReport(mockDashboardData, projectReport)
			: buildNoRoadmapData(projectReport);

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

/** report의 이름·마감만 mock에 덮어쓰기. 나머지 팀원·진척도 등은 mock 그대로. */
function overlayReport(
	mock: DashboardData,
	report: ProjectReport,
): DashboardData {
	return {
		...mock,
		project: {
			...mock.project,
			name: report.name,
			deadline: report.deadline,
		},
	};
}

/** 로드맵 미생성 상태에서 Dashboard가 보여줄 "최소 정보". */
function buildNoRoadmapData(report: ProjectReport): DashboardData {
	const deadlineDate = new Date(report.deadline + "T00:00:00");
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const daysLeft = Math.max(
		0,
		Math.round(
			(deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
		),
	);
	return {
		project: {
			name: report.name,
			deadline: report.deadline,
			daysUntilPrototype: null,
			totalDays: daysLeft,
		},
		progress: { totalTasks: 0, completedTasks: 0, thisWeekCommits: 0 },
		prototypeProgress: null,
		developmentProgress: { percent: 0, dday: daysLeft },
		myTasks: { inProgress: 0, total: 0, memberName: "나" },
		members: [],
		meetings: [],
		importantDates: [
			{ label: "최종 마감", date: report.deadline, dday: daysLeft },
		],
		alerts: [
			{
				severity: "info",
				text: "기획 로드맵이 아직 없습니다. Roadmap 탭에서 생성해주세요.",
			},
		],
	};
}
