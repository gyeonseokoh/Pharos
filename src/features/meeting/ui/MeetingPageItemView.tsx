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
	getMeetingPageMock,
	meetingPageMocks,
} from "./meetingPageMock";
import { mockCalendarData } from "./calendarMock";
import { VIEW_TYPE_PHAROS_CALENDAR } from "./CalendarItemView";

export const VIEW_TYPE_PHAROS_MEETING_PAGE = "pharos-meeting-page-view";

interface MeetingPageViewState {
	meetingId: string;
}

export class MeetingPageItemView extends ItemView {
	private root: Root | null = null;
	private meetingId: string | null = null;

	constructor(leaf: WorkspaceLeaf) {
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
			this.ensureRoot();
			this.render();
		}
		return super.setState(state, result);
	}

	getState(): Record<string, unknown> {
		return { meetingId: this.meetingId };
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
		const data = this.meetingId
			? getMeetingPageMock(this.meetingId, this.fallbackFromCalendar(this.meetingId))
			: null;

		if (!data) {
			this.root.render(<EmptyState />);
			return;
		}

		this.root.render(
			<MeetingPageView
				data={data}
				onBack={() => void this.openCalendar()}
				onGenerateTopics={() =>
					new Notice("[미구현] AI 주제 생성 Modal이 열릴 예정")
				}
				onEditMinutes={() =>
					new Notice("[미구현] 회의록 편집 화면이 열릴 예정")
				}
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

	private async openCalendar(): Promise<void> {
		const { workspace } = this.app;
		const [existing] = workspace.getLeavesOfType(VIEW_TYPE_PHAROS_CALENDAR);
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_PHAROS_CALENDAR, active: true });
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
