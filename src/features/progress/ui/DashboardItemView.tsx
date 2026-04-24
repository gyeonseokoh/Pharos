/**
 * DashboardItemView — DashboardView(React 컴포넌트)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * 이 어댑터가 "데이터 공급책" 역할도 함:
 *   - 오늘: `mockDashboardData`를 props로 주입
 *   - 미래: `progressService.getSummary()` 결과를 주입 (DashboardView 자체는 무변경)
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { DashboardView } from "./DashboardView";
import { mockDashboardData } from "./mock";
import { VIEW_TYPE_PHAROS_MY_TASKS } from "./MyTasksItemView";
import { VIEW_TYPE_PHAROS_PROGRESS } from "./ProgressPageItemView";
import { VIEW_TYPE_PHAROS_CALENDAR } from "../../meeting/ui/CalendarItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "../../meeting/ui/MeetingsListItemView";
import { AiTopicModal } from "../../meeting/ui/AiTopicModal";
import { ProjectSettingsModal } from "../../project/ui/ProjectSettingsModal";
import { VIEW_TYPE_PHAROS_ROADMAP } from "../../roadmap/ui/RoadmapItemView";
import { VIEW_TYPE_PHAROS_TEAM_LIST } from "../../team/ui/TeamListItemView";

export const VIEW_TYPE_PHAROS_DASHBOARD = "pharos-dashboard-view";

export class DashboardItemView extends ItemView {
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf) {
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
		this.root.render(
			<DashboardView
				data={mockDashboardData}
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
						topic: mockDashboardData.project.name,
						description: "",
						deadline: mockDashboardData.project.deadline,
					}).open()
				}
			/>,
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
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
