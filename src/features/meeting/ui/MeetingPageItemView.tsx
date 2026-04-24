/**
 * MeetingPageItemView — MeetingPageView를 Obsidian ItemView 탭으로 감싸는 어댑터.
 *
 * 이 뷰는 meetingId 파라미터가 필요하다. Obsidian의 ViewState.state 로 전달받음.
 *   - Calendar에서 회의 클릭 → `leaf.setViewState({ type, state: { meetingId } })`
 *   - setState가 불리면 새 meetingId로 재렌더.
 *
 * 오늘: meetingPageMocks[meetingId] 에서 조회 (없으면 fallback placeholder)
 * 미래: meetingService.get(meetingId) 결과 주입
 */

import { ItemView, WorkspaceLeaf, type ViewStateResult, Notice } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { MeetingPageView } from "./MeetingPageView";
import {
	applyAttachedMinutes,
	getMeetingPageMock,
	meetingPageMocks,
} from "./meetingPageMock";
import { mockCalendarData } from "./calendarMock";
import { VIEW_TYPE_PHAROS_CALENDAR } from "./CalendarItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "./MeetingsListItemView";
import { VIEW_TYPE_PHAROS_MINUTES_ARCHIVE } from "./MinutesArchiveItemView";
import { VIEW_TYPE_PHAROS_TOPIC_PAGE } from "./TopicPageItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import { AiTopicModal } from "./AiTopicModal";
import type { PharosPluginLike } from "../../../app/settings";

export const VIEW_TYPE_PHAROS_MEETING_PAGE = "pharos-meeting-page-view";

export type MeetingPageSource =
	| "calendar"
	| "meetings-list"
	| "minutes-archive";

interface MeetingPageViewState {
	meetingId: string;
	/** 이 뷰를 연 상위 뷰. back 버튼 라벨·목적지가 여기에 따라 결정됨. */
	source?: MeetingPageSource;
}

export class MeetingPageItemView extends ItemView {
	private root: Root | null = null;
	private meetingId: string | null = null;
	private source: MeetingPageSource = "calendar";

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
		if (!this.meetingId) return "회의 페이지";
		const data = meetingPageMocks[this.meetingId];
		return data?.title ?? "회의 페이지";
	}

	getIcon(): string {
		return "file-text";
	}

	async onOpen(): Promise<void> {
		this.ensureRoot();
		this.render();

		this.registerEvent(
			this.app.workspace.on("pharos:state-changed" as never, () =>
				this.render(),
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
			this.render();
		}
		return super.setState(state, result);
	}

	getState(): Record<string, unknown> {
		return { meetingId: this.meetingId, source: this.source };
	}

	// ───────────────────────── internals ─────────────────────────

	private ensureRoot(): void {
		if (this.root) return;
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
	}

	private render(): void {
		if (!this.root) return;

		// meetingId 로 데이터 조회. 없으면 캘린더 목업에서 기본 정보라도 가져옴.
		const mock = this.meetingId
			? getMeetingPageMock(this.meetingId, this.fallbackFromCalendar(this.meetingId))
			: null;

		if (!mock) {
			this.root.render(<EmptyState />);
			return;
		}

		// 업로드된 회의록이 있으면 덮어써 반영
		const data = applyAttachedMinutes(
			mock,
			this.plugin.settings.attachedMinutes,
		);

		// source에 따라 back 버튼 하나만 표시 (+ 홈으로는 항상)
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
				data={data}
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

	private fallbackFromCalendar(meetingId: string):
		| {
				title: string;
				date: string;
				time: string;
				type: "regular" | "adhoc";
		  }
		| undefined {
		const m = mockCalendarData.meetings.find((m) => m.id === meetingId);
		if (!m) return undefined;
		return { title: m.title, date: m.date, time: m.time, type: m.type };
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
				회의 ID가 지정되지 않았습니다.
			</p>
		</div>
	);
}
