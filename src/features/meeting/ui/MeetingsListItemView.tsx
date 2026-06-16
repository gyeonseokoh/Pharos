/**
 * MeetingsListItemView — 회의 목록 뷰를 Obsidian 탭으로 감싸는 어댑터.
 *
 * 회의 카드 클릭 → Meeting Page 열기 (meetingId 전달).
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { MeetingsListView } from "./MeetingsListView";
import { VIEW_TYPE_PHAROS_CALENDAR } from "./CalendarItemView";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "./MeetingPageItemView";
import { VIEW_TYPE_PHAROS_MINUTES_ARCHIVE } from "./MinutesArchiveItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import { AdhocMeetingModal } from "./AdhocMeetingModal";
// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────────
// 연동 완료 후 이 import 줄을 삭제하세요.
import { mockMeetingsListData } from "./meetingsListMock";
// ──────────────────────────────────────────────────────────────────────────────
import type { MeetingsListData } from "../domain/meetingsListData";
import type { PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_MEETINGS_LIST = "pharos-meetings-list-view";

export class MeetingsListItemView extends ItemView {
	private root: Root | null = null;
	private meetingsListData: MeetingsListData = { meetings: [] };

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
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
			this.meetingsListData = mockMeetingsListData;
			this.render();
			return;
		}
		// ──────────────────────────────────────────────────────────────────────────────

		// ── [연동 후 실행되는 실서비스 흐름] ────────────────────────────────────────────
		// demoMode 블록을 삭제하면 아래 코드가 실행됩니다.
		// settings.projectReport(레거시) 대신 projectService.get()으로 프로젝트를 확인합니다.
		// 프로젝트가 없으면 ProjectRequiredEmpty를 직접 렌더하고 종료합니다.
		// ────────────────────────────────────────────────────────────────────────────────
		const project = await this.plugin.projectService.get();
		if (!project) {
			this.root?.render(
				<ProjectRequiredEmpty
					viewName="회의 목록"
					onOpenDashboard={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
				/>,
			);
			return;
		}

		// PO-1-1 정기 회의 자동 생성 (멱등). project 의 fixedMeetingDay/Time 기준.
		await this.plugin.meetingsService.ensureRegularMeetings(project);

		const meetings = await this.plugin.meetingsService.list();
		this.meetingsListData = {
			meetings: meetings.map((m) => ({
				id: m.id,
				title: m.title,
				date: m.date,
				time: m.time,
				durationMinutes: m.durationMinutes,
				type: m.meetingType,
				status: m.status,
				topicCount: m.topics.length,
				attendeeCount: m.attendees.length,
				hasMinutes: m.minutes !== null,
			})),
		};
		this.render();
	}

	private render(): void {
		if (!this.root) return;
		this.root.render(
			<MeetingsListView
				data={this.meetingsListData}
				onOpenMeeting={(id) => void this.openMeetingPage(id)}
				onOpenCalendar={() => void this.openCalendar()}
				onAddAdhocMeeting={() => new AdhocMeetingModal(this.app, this.plugin).open()}
				onOpenMinutesArchive={() =>
					void this.openView(VIEW_TYPE_PHAROS_MINUTES_ARCHIVE)
				}
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
			/>,
		);
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
			state: { meetingId, source: "meetings-list" },
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
