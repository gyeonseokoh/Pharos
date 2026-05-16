import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { MinutesArchiveView } from "./MinutesArchiveView";
import { MinutesUploadModal } from "./MinutesUploadModal";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "./MeetingPageItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "./MeetingsListItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import type { MinutesArchiveData } from "../domain/minutesArchiveData";
import type { MeetingPageData } from "../domain/meetingPageData";
import type { AttachedMinute, PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_MINUTES_ARCHIVE = "pharos-minutes-archive-view";

export class MinutesArchiveItemView extends ItemView {
	private root: Root | null = null;
	private archiveData: MinutesArchiveData = { items: [] };
	private candidateMeetings: MeetingPageData[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_MINUTES_ARCHIVE;
	}

	getDisplayText(): string {
		return "회의록 관리";
	}

	getIcon(): string {
		return "library";
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
		const [allMeetings, withoutMinutes] = await Promise.all([
			this.plugin.meetingsService.list(),
			this.plugin.meetingsService.listMeetingsWithoutMinutes(),
		]);

		// 회의록이 있는 회의를 최신순으로 정렬
		const withMinutes = allMeetings
			.filter((m) => m.minutes !== null)
			.sort((a, b) =>
				(b.minutes!.writtenAt > a.minutes!.writtenAt ? 1 : -1),
			);

		this.archiveData = {
			items: withMinutes.map((m) => ({
				meetingId: m.id,
				meetingTitle: m.title,
				meetingDate: m.date,
				meetingType: m.meetingType,
				authorName: m.minutes!.authorName,
				writtenAt: m.minutes!.writtenAt,
				preview: m.minutes!.content.slice(0, 200),
				aiSummary: m.analysis?.summary ?? null,
				length: m.minutes!.content.length,
				categories: m.analysis?.categories ?? [],
			})),
		};

		// 회의록 업로드 모달용 후보 목록 (MeetingPageData 형태)
		this.candidateMeetings = withoutMinutes.map((m) => ({
			id: m.id,
			title: m.title,
			date: m.date,
			time: m.time,
			durationMinutes: m.durationMinutes,
			type: m.meetingType,
			status: m.status,
			attendees: m.attendees,
			topics: m.topics,
			resources: m.resources,
			minutes: null,
			analysis: null,
		}));

		this.render();
	}

	private render(): void {
		if (!this.root) return;
		if (!this.plugin.settings.projectReport) {
			this.root.render(
				<ProjectRequiredEmpty
					viewName="회의록 관리"
					onOpenDashboard={() =>
						void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)
					}
				/>,
			);
			return;
		}
		this.root.render(
			<MinutesArchiveView
				data={this.archiveData}
				onOpenMeeting={(id) => void this.openMeeting(id)}
				onUploadMinutes={() => this.openUploadModal()}
				onBackToMeetingsList={() =>
					void this.openView(VIEW_TYPE_PHAROS_MEETINGS_LIST)
				}
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
			/>,
		);
	}

	private openUploadModal(): void {
		new MinutesUploadModal(this.app, {
			candidates: this.candidateMeetings,
			defaultAuthorName: "",
			onApprove: (meetingId, attached) =>
				this.saveAttachedMinute(meetingId, attached),
		}).open();
	}

	private async saveAttachedMinute(
		meetingId: string,
		attached: AttachedMinute,
	): Promise<void> {
		const existing = await this.plugin.meetingsService.getById(meetingId);
		if (existing) {
			await this.plugin.meetingsService.attachMinutes({
				meetingId,
				content: attached.minutes.content,
				authorName: attached.minutes.authorName,
			});
		} else {
			this.plugin.settings.attachedMinutes = {
				...this.plugin.settings.attachedMinutes,
				[meetingId]: attached,
			};
			await this.plugin.saveSettings();
		}
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

	private async openMeeting(meetingId: string): Promise<void> {
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
			state: { meetingId, source: "minutes-archive" },
			active: true,
		});
	}
}
