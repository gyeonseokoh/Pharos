import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { MinutesArchiveView } from "./MinutesArchiveView";
import { buildMinutesArchiveData } from "./minutesArchiveMock";
import { listMeetingsWithoutMinutes } from "./meetingPageMock";
import { MinutesUploadModal } from "./MinutesUploadModal";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "./MeetingPageItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "./MeetingsListItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import type { AttachedMinute, PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_MINUTES_ARCHIVE = "pharos-minutes-archive-view";

export class MinutesArchiveItemView extends ItemView {
	private root: Root | null = null;

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
					viewName="회의록 관리"
					onOpenDashboard={() =>
						void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)
					}
				/>,
			);
			return;
		}
		const data = buildMinutesArchiveData(this.plugin.settings.attachedMinutes);
		this.root.render(
			<MinutesArchiveView
				data={data}
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
		const candidates = listMeetingsWithoutMinutes(
			this.plugin.settings.attachedMinutes,
		);
		new MinutesUploadModal(this.app, {
			candidates,
			defaultAuthorName: "유석",
			onApprove: (meetingId, attached) =>
				this.saveAttachedMinute(meetingId, attached),
		}).open();
	}

	private async saveAttachedMinute(
		meetingId: string,
		attached: AttachedMinute,
	): Promise<void> {
		this.plugin.settings.attachedMinutes = {
			...this.plugin.settings.attachedMinutes,
			[meetingId]: attached,
		};
		await this.plugin.saveSettings();
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
