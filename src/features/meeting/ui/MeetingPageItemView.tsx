/**
 * MeetingPageItemView — MeetingPageView를 Obsidian ItemView 탭으로 감싸는 어댑터.
 *
 * state: { meetingId, source? }
 * meetingId → meetingsService.getById() → MeetingPageData 렌더.
 */

import { ItemView, Notice, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import type { TFile } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { MeetingPageView } from "./MeetingPageView";
import { ResourceUploadModal } from "./ResourceUploadModal";
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
				// plugin과 meetingId를 전달해 선택된 주제가 올바른 회의에 저장되게 함
				// (시나리오.md §8: PO-2 주제 확정 → Meeting.topics[] → PO-6 개발 로드맵 입력)
				onGenerateTopics={() =>
					new AiTopicModal(this.app, this.plugin, this.meetingId!).open()
				}
				onEditMinutes={() => void this.openMinutesFile()}
				// meetingId와 현재 주제 목록을 전달해 ResourceUploadModal이 저장 대상을 특정
				onAddResource={() =>
					new ResourceUploadModal(
						this.app,
						this.plugin,
						this.meetingId!,
						(this.meetingData?.topics ?? []).map((t) => ({
							id: t.id,
							title: t.title,
						})),
					).open()
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

	/**
	 * 회의록 .md 파일을 Obsidian 네이티브 에디터 탭으로 엽니다 (PO-5).
	 *
	 * 파일 경로는 VaultMeetingRepository.computeFilePath()와 동일한 규칙:
	 *   {projectRoot}/Meetings/{date}_{slug}.md
	 * 파일이 없으면 아직 Vault에 저장되지 않은 것이므로 Notice 안내.
	 */
	private async openMinutesFile(): Promise<void> {
		if (!this.meetingData) return;
		const { projectRoot } = this.plugin.settings;
		const slug = this.meetingData.title
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^\w가-힣-]/g, "")
			.slice(0, 40);
		const path = `${projectRoot}/Meetings/${this.meetingData.date}_${slug}.md`;
		const file = this.app.vault.getAbstractFileByPath(path) as TFile | null;
		if (!file) {
			new Notice("회의록 파일이 없습니다. 먼저 회의가 Vault에 저장되어야 합니다.");
			return;
		}
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.openFile(file);
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
