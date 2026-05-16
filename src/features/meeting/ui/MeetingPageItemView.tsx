/**
 * MeetingPageItemView — MeetingPageView를 Obsidian ItemView 탭으로 감싸는 어댑터.
 *
 * state: { meetingId, source? }
 * meetingId → meetingsService.getById() → MeetingPageData 렌더.
 */

import { ItemView, WorkspaceLeaf, type ViewStateResult, Notice } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { MeetingPageView } from "./MeetingPageView";
import { VIEW_TYPE_PHAROS_CALENDAR } from "./CalendarItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "./MeetingsListItemView";
import { VIEW_TYPE_PHAROS_MINUTES_ARCHIVE } from "./MinutesArchiveItemView";
import { VIEW_TYPE_PHAROS_TOPIC_PAGE } from "./TopicPageItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import { AiTopicModal } from "./AiTopicModal";
import type { MeetingPageData } from "../domain/meetingPageData";
import type { PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_MEETING_PAGE = "pharos-meeting-page-view";

export type MeetingPageSource =
	| "calendar"
	| "meetings-list"
	| "minutes-archive";

interface MeetingPageViewState {
	meetingId: string;
	source?: MeetingPageSource;
}

export class MeetingPageItemView extends ItemView {
	private root: Root | null = null;
	private meetingId: string | null = null;
	private source: MeetingPageSource = "calendar";
	private meetingData: MeetingPageData | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_MEETING_PAGE;
	}

	getDisplayText(): string {
		return this.meetingData?.title ?? "회의 페이지";
	}

	getIcon(): string {
		return "file-text";
	}

	async onOpen(): Promise<void> {
		this.ensureRoot();
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

	async setState(
		state: MeetingPageViewState | unknown,
		result: ViewStateResult,
	): Promise<void> {
		const s = state as MeetingPageViewState | undefined;
		if (s?.meetingId) {
			this.meetingId = s.meetingId;
			if (s.source) this.source = s.source;
			this.ensureRoot();
			await this.loadAndRender();
		}
		return super.setState(state, result);
	}

	getState(): Record<string, unknown> {
		return { meetingId: this.meetingId, source: this.source };
	}

	private ensureRoot(): void {
		if (this.root) return;
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
	}

	private async loadAndRender(): Promise<void> {
		if (!this.meetingId) {
			this.meetingData = null;
			this.render();
			return;
		}

		const meeting = await this.plugin.meetingsService.getById(this.meetingId);
		if (!meeting) {
			this.meetingData = null;
			this.render();
			return;
		}

		this.meetingData = {
			id: meeting.id,
			title: meeting.title,
			date: meeting.date,
			time: meeting.time,
			durationMinutes: meeting.durationMinutes,
			type: meeting.meetingType,
			status: meeting.status,
			attendees: meeting.attendees,
			topics: meeting.topics,
			resources: meeting.resources,
			minutes: meeting.minutes,
			analysis: meeting.analysis,
		};
		this.render();
	}

	private render(): void {
		if (!this.root) return;

		if (!this.meetingData) {
			this.root.render(<EmptyState />);
			return;
		}

		const backProps = {
			onBackToMeetingsList:
				this.source === "meetings-list"
					? () => void this.openView(VIEW_TYPE_PHAROS_MEETINGS_LIST)
					: undefined,
			onBackToMinutesArchive:
				this.source === "minutes-archive"
					? () => void this.openView(VIEW_TYPE_PHAROS_MINUTES_ARCHIVE)
					: undefined,
			onBackToCalendar:
				this.source === "calendar"
					? () => void this.openView(VIEW_TYPE_PHAROS_CALENDAR)
					: undefined,
		};

		this.root.render(
			<MeetingPageView
				data={this.meetingData}
				{...backProps}
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
				onGenerateTopics={() => new AiTopicModal(this.app).open()}
				onEditMinutes={() =>
					new Notice(
						"[미구현] 회의록 편집은 Obsidian 네이티브 에디터로 열 예정",
					)
				}
				onOpenTopic={(topicId) => void this.openTopic(topicId)}
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

	private async openTopic(topicId: string): Promise<void> {
		if (!this.meetingId) return;
		const { workspace } = this.app;
		const existing = workspace
			.getLeavesOfType(VIEW_TYPE_PHAROS_TOPIC_PAGE)
			.find((leaf) => {
				const s = leaf.getViewState().state as
					| { meetingId?: string; topicId?: string }
					| undefined;
				return s?.meetingId === this.meetingId && s?.topicId === topicId;
			});
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_PHAROS_TOPIC_PAGE,
			state: { meetingId: this.meetingId, topicId },
			active: true,
		});
	}
}

function EmptyState() {
	return (
		<div className="pharos-root flex min-h-full w-full items-center justify-center p-6">
			<p className="text-sm text-text-muted">
				회의를 찾을 수 없습니다.
			</p>
		</div>
	);
}
