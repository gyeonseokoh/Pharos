import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { MinutesArchiveView } from "./MinutesArchiveView";
import { mockMinutesArchiveData } from "./minutesArchiveMock";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "./MeetingPageItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "./MeetingsListItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";

export const VIEW_TYPE_PHAROS_MINUTES_ARCHIVE = "pharos-minutes-archive-view";

export class MinutesArchiveItemView extends ItemView {
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_MINUTES_ARCHIVE;
	}

	getDisplayText(): string {
		return "회의록 모음";
	}

	getIcon(): string {
		return "library";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
		this.root.render(
			<MinutesArchiveView
				data={mockMinutesArchiveData}
				onOpenMeeting={(id) => void this.openMeeting(id)}
				onBackToMeetingsList={() =>
					void this.openView(VIEW_TYPE_PHAROS_MEETINGS_LIST)
				}
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
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
			state: { meetingId },
			active: true,
		});
	}
}
