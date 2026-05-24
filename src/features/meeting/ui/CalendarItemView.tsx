/**
 * CalendarItemView — CalendarView(회의 캘린더)를 Obsidian ItemView로 감싸는 어댑터.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { CalendarView } from "./CalendarView";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "./MeetingPageItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import { AdhocMeetingModal } from "./AdhocMeetingModal";
// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────────
// 연동 완료 후 이 import 줄을 삭제하세요.
import { mockCalendarData } from "./calendarMock";
// ──────────────────────────────────────────────────────────────────────────────
import type { CalendarData } from "../domain/calendarData";
import type { PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_CALENDAR = "pharos-calendar-view";

export class CalendarItemView extends ItemView {
	private root: Root | null = null;
	private calendarData: CalendarData = { meetings: [] };

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
			this.calendarData = mockCalendarData;
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
					viewName="캘린더"
					onOpenDashboard={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
				/>,
			);
			return;
		}

		const meetings = await this.plugin.meetingsService.list();
		this.calendarData = {
			meetings: meetings.map((m) => ({
				id: m.id,
				title: m.title,
				date: m.date,
				time: m.time,
				durationMinutes: m.durationMinutes,
				type: m.meetingType,
				topicCount: m.topics.length,
			})),
		};
		this.render();
	}

	private render(): void {
		if (!this.root) return;
		this.root.render(
			<CalendarView
				data={this.calendarData}
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

	private async handleOpenMeeting(meetingId: string): Promise<void> {
		const { workspace } = this.app;
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
