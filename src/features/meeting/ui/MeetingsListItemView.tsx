/**
 * MeetingsListItemView — 회의 목록 뷰를 Obsidian 탭으로 감싸는 어댑터.
 *
 * 회의 카드 클릭 → Meeting Page 열기 (meetingId 전달).
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { MeetingsListView } from "./MeetingsListView";
import { mockMeetingsListData } from "./meetingsListMock";
import { VIEW_TYPE_PHAROS_CALENDAR } from "./CalendarItemView";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "./MeetingPageItemView";
import { VIEW_TYPE_PHAROS_MINUTES_ARCHIVE } from "./MinutesArchiveItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import { AdhocMeetingModal } from "./AdhocMeetingModal";

export const VIEW_TYPE_PHAROS_MEETINGS_LIST = "pharos-meetings-list-view";

export class MeetingsListItemView extends ItemView {
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_MEETINGS_LIST;
	}

	getDisplayText(): string {
		return "회의 목록";
	}

	getIcon(): string {
		return "list";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
		this.root.render(
			<MeetingsListView
				data={mockMeetingsListData}
				onOpenMeeting={(id) => void this.openMeetingPage(id)}
				onOpenCalendar={() => void this.openCalendar()}
				onAddAdhocMeeting={() => new AdhocMeetingModal(this.app).open()}
				onOpenMinutesArchive={() => void this.openView(VIEW_TYPE_PHAROS_MINUTES_ARCHIVE)}
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
			/>,
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
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

	private async openCalendar(): Promise<void> {
		await this.openView(VIEW_TYPE_PHAROS_CALENDAR);
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
