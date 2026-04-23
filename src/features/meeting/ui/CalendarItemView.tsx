/**
 * CalendarItemView — CalendarView(회의 캘린더)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * 오늘: mockCalendarData 주입, 회의 클릭 시 MeetingPageView 탭 열기.
 * 미래: meetingService.listAll() 주입, 실제 회의 페이지(MD 파일)로 이동.
 */

import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { CalendarView } from "./CalendarView";
import { mockCalendarData } from "./calendarMock";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "./MeetingPageItemView";

export const VIEW_TYPE_PHAROS_CALENDAR = "pharos-calendar-view";

export class CalendarItemView extends ItemView {
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf) {
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
		this.root.render(
			<CalendarView
				data={mockCalendarData}
				onOpenMeeting={(id) => void this.handleOpenMeeting(id)}
				onAddAdhocMeeting={(date) => this.handleAddAdhocMeeting(date)}
			/>,
		);
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
			state: { meetingId },
			active: true,
		});
	}

	private handleAddAdhocMeeting(date?: string): void {
		// MVP: 실제 Modal 열리기 전까지 자리표시만
		new Notice(
			date
				? `[미구현] ${date} 에 임시 회의 추가 Modal이 열릴 예정`
				: "[미구현] 임시 회의 추가 Modal이 열릴 예정",
		);
	}
}
