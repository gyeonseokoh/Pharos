/**
 * TopicPageItemView — Topic Page를 Obsidian ItemView로 감싸는 어댑터.
 *
 * state: { meetingId, topicId }
 * meetingId → meetingsService.getById() → topics에서 topicId 추출 → TopicPageData 렌더.
 */

import { ItemView, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { TopicPageView } from "./TopicPageView";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "./MeetingPageItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import type { TopicPageData } from "../domain/topicPageData";
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
	private topicData: TopicPageData | null = null;

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
		return this.topicData ? `주제: ${this.topicData.topic.title}` : "회의 주제";
	}

	getIcon(): string {
		return "pin";
	}

	async onOpen(): Promise<void> {
		this.ensureRoot();
		void this.loadAndRender();
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
			await this.loadAndRender();
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

	private async loadAndRender(): Promise<void> {
		if (!this.meetingId || !this.topicId) {
			this.topicData = null;
			this.render();
			return;
		}

		const meeting = await this.plugin.meetingsService.getById(this.meetingId);
		const topic = meeting?.topics.find((t) => t.id === this.topicId) ?? null;

		if (!meeting || !topic) {
			this.topicData = null;
			this.render();
			return;
		}

		this.topicData = {
			meeting: {
				id: meeting.id,
				title: meeting.title,
				date: meeting.date,
				time: meeting.time,
			},
			topic,
			resources: meeting.resources.filter((r) => r.topicId === this.topicId),
			decisions: meeting.analysis?.decisions ?? [],
			minutesExcerpt: null,
		};
		this.render();
	}

	private render(): void {
		if (!this.root) return;

		if (!this.meetingId || !this.topicId) {
			this.root.render(<Empty text="주제 ID가 지정되지 않았습니다." />);
			return;
		}
		if (!this.topicData) {
			this.root.render(<Empty text="주제를 찾을 수 없습니다." />);
			return;
		}

		this.root.render(
			<TopicPageView
				data={this.topicData}
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
