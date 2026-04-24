/**
 * TopicPageItemView — Topic Page를 Obsidian ItemView로 감싸는 어댑터.
 *
 * state: { meetingId, topicId }
 */

import { ItemView, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { TopicPageView } from "./TopicPageView";
import { getTopicPageMock } from "./topicPageMock";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "./MeetingPageItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import type { PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_TOPIC_PAGE = "pharos-topic-page-view";

interface TopicPageViewState {
	meetingId: string;
	topicId: string;
}

export class TopicPageItemView extends ItemView {
	private root: Root | null = null;
	private meetingId: string | null = null;
	private topicId: string | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_TOPIC_PAGE;
	}

	getDisplayText(): string {
		if (!this.meetingId || !this.topicId) return "회의 주제";
		const data = getTopicPageMock(this.meetingId, this.topicId);
		return data ? `주제: ${data.topic.title}` : "회의 주제";
	}

	getIcon(): string {
		return "pin";
	}

	async onOpen(): Promise<void> {
		this.ensureRoot();
		this.render();
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const s = state as TopicPageViewState | undefined;
		if (s?.meetingId && s?.topicId) {
			this.meetingId = s.meetingId;
			this.topicId = s.topicId;
			this.ensureRoot();
			this.render();
		}
		return super.setState(state, result);
	}

	getState(): Record<string, unknown> {
		return { meetingId: this.meetingId, topicId: this.topicId };
	}

	private ensureRoot(): void {
		if (this.root) return;
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
	}

	private render(): void {
		if (!this.root) return;

		if (!this.meetingId || !this.topicId) {
			this.root.render(<Empty text="주제 ID가 지정되지 않았습니다." />);
			return;
		}

		const data = getTopicPageMock(this.meetingId, this.topicId);
		if (!data) {
			this.root.render(<Empty text="주제를 찾을 수 없습니다." />);
			return;
		}

		this.root.render(
			<TopicPageView
				data={data}
				onBackToMeeting={() => void this.openMeeting()}
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

	private async openMeeting(): Promise<void> {
		if (!this.meetingId) return;
		const { workspace } = this.app;
		const existing = workspace
			.getLeavesOfType(VIEW_TYPE_PHAROS_MEETING_PAGE)
			.find((leaf) => {
				const s = leaf.getViewState().state as
					| { meetingId?: string }
					| undefined;
				return s?.meetingId === this.meetingId;
			});
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_PHAROS_MEETING_PAGE,
			state: { meetingId: this.meetingId },
			active: true,
		});
	}
}

function Empty({ text }: { text: string }) {
	return (
		<div className="pharos-root flex min-h-full w-full items-center justify-center p-6">
			<p className="text-sm text-text-muted">{text}</p>
		</div>
	);
}
