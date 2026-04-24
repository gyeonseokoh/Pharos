/**
 * CalendarItemView — CalendarView(회의 캘린더)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * 오늘: mockCalendarData 주입, 회의 클릭 시 MeetingPageView 탭 열기.
 * 미래: meetingService.listAll() 주입, 실제 회의 페이지(MD 파일)로 이동.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { CalendarView } from "./CalendarView";
import { mockCalendarData } from "./calendarMock";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "./MeetingPageItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import { AdhocMeetingModal } from "./AdhocMeetingModal";
import type { PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_CALENDAR = "pharos-calendar-view";

export class CalendarItemView extends ItemView {
	private root: Root | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_CALENDAR;
	}

	getDisplayText(): string {
		return "Pharos 캘린더";
	}

	getIcon(): string {
		return "calendar";
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
					viewName="캘린더"
					onOpenDashboard={() =>
						void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)
					}
				/>,
			);
			return;
		}
		this.root.render(
			<CalendarView
				data={mockCalendarData}
				onOpenMeeting={(id) => void this.handleOpenMeeting(id)}
				onAddAdhocMeeting={(date) => this.handleAddAdhocMeeting(date)}
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

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	// ───────────────────────── Handlers ─────────────────────────

	private async handleOpenMeeting(meetingId: string): Promise<void> {
		const { workspace } = this.app;

		// 이미 같은 meetingId로 열린 탭이 있으면 그쪽으로 포커스
		const existing = workspace
			.getLeavesOfType(VIEW_TYPE_PHAROS_MEETING_PAGE)
			.find((leaf) => {
				const state = leaf.getViewState().state as
					| { meetingId?: string }
					| undefined;
				return state?.meetingId === meetingId;
			});

		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}

		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_PHAROS_MEETING_PAGE,
			state: { meetingId, source: "calendar" },
			active: true,
		});
	}

	private handleAddAdhocMeeting(date?: string): void {
		new AdhocMeetingModal(this.app, date).open();
	}
}
