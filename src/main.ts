import { Plugin } from "obsidian";
import {
	DashboardItemView,
	VIEW_TYPE_PHAROS_DASHBOARD,
} from "./features/progress/ui/DashboardItemView";
import {
	MyTasksItemView,
	VIEW_TYPE_PHAROS_MY_TASKS,
} from "./features/progress/ui/MyTasksItemView";
import {
	ProgressPageItemView,
	VIEW_TYPE_PHAROS_PROGRESS,
} from "./features/progress/ui/ProgressPageItemView";
import {
	CalendarItemView,
	VIEW_TYPE_PHAROS_CALENDAR,
} from "./features/meeting/ui/CalendarItemView";
import {
	MeetingPageItemView,
	VIEW_TYPE_PHAROS_MEETING_PAGE,
} from "./features/meeting/ui/MeetingPageItemView";
import {
	MeetingsListItemView,
	VIEW_TYPE_PHAROS_MEETINGS_LIST,
} from "./features/meeting/ui/MeetingsListItemView";
import {
	RoadmapItemView,
	VIEW_TYPE_PHAROS_ROADMAP,
} from "./features/roadmap/ui/RoadmapItemView";

export default class PharosPlugin extends Plugin {
	async onload(): Promise<void> {
		// 뷰 타입 등록
		this.registerView(
			VIEW_TYPE_PHAROS_DASHBOARD,
			(leaf) => new DashboardItemView(leaf),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_ROADMAP,
			(leaf) => new RoadmapItemView(leaf),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_PROGRESS,
			(leaf) => new ProgressPageItemView(leaf),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_MY_TASKS,
			(leaf) => new MyTasksItemView(leaf),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_CALENDAR,
			(leaf) => new CalendarItemView(leaf),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_MEETING_PAGE,
			(leaf) => new MeetingPageItemView(leaf),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_MEETINGS_LIST,
			(leaf) => new MeetingsListItemView(leaf),
		);

		// Ribbon 아이콘
		this.addRibbonIcon("layout-dashboard", "Pharos Dashboard", () => {
			void this.activateView(VIEW_TYPE_PHAROS_DASHBOARD);
		});

		// 명령 팔레트
		this.addCommand({
			id: "open-dashboard",
			name: "Open Pharos Dashboard",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_DASHBOARD),
		});
		this.addCommand({
			id: "open-roadmap",
			name: "Open Pharos Roadmap",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_ROADMAP),
		});
		this.addCommand({
			id: "open-progress",
			name: "Open Team Progress",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_PROGRESS),
		});
		this.addCommand({
			id: "open-my-tasks",
			name: "Open My Tasks",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_MY_TASKS),
		});
		this.addCommand({
			id: "open-calendar",
			name: "Open Pharos Calendar",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_CALENDAR),
		});
		this.addCommand({
			id: "open-meetings",
			name: "Open Meetings List",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_MEETINGS_LIST),
		});
	}

	async onunload(): Promise<void> {
		// 플러그인 비활성 시 열린 탭 정리 (선택)
	}

	/**
	 * 지정한 뷰 타입의 탭이 이미 있으면 포커스, 없으면 새 탭으로 오픈.
	 */
	async activateView(viewType: string): Promise<void> {
		const { workspace } = this.app;

		const [existing] = workspace.getLeavesOfType(viewType);
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}

		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: viewType,
			active: true,
		});
	}
}
