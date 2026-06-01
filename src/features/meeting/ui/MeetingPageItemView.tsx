/**
 * MeetingPageItemView — MeetingPageView를 Obsidian ItemView 탭으로 감싸는 어댑터.
 *
 * state: { meetingId, source? }
 * meetingId → meetingsService.getById() → MeetingPageData 렌더.
 */

import { ItemView, WorkspaceLeaf, type ViewStateResult, Notice, type TFile, MarkdownView } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { MeetingPageView } from "./MeetingPageView";
import { VIEW_TYPE_PHAROS_CALENDAR } from "./CalendarItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "./MeetingsListItemView";
import { VIEW_TYPE_PHAROS_MINUTES_ARCHIVE } from "./MinutesArchiveItemView";
import { VIEW_TYPE_PHAROS_TOPIC_PAGE } from "./TopicPageItemView";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
import { AiTopicModal } from "./AiTopicModal";
import { getMeetingPageMock } from "./meetingPageMock";
import { mockCalendarData } from "./calendarMock";
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

// ── [DEMO] AI 미연동 시 사용할 임시 자료 후보 ─────────────────────────────────
// 연동 완료 후 mockResources 와 demoMode 분기 제거.
// ──────────────────────────────────────────────────────────────────────────────
const MOCK_COLLECTED_RESOURCES = [
	{
		topicId: null,
		title: "캡스톤 디자인 우수 사례 모음",
		summary:
			"국내 주요 대학 캡스톤 프로젝트의 기획·발표 자료 모음. 평가 기준과 데모 영상 포함.",
		sourceUrl: "https://example.com/capstone-best",
	},
	{
		topicId: null,
		title: "Obsidian Plugin API 가이드",
		summary:
			"Obsidian 공식 플러그인 API 문서. ItemView / Modal / Settings 패턴 핵심 요약.",
		sourceUrl: "https://docs.obsidian.md/Plugins/Getting+started",
	},
] as const;

export class MeetingPageItemView extends ItemView {
	private root: Root | null = null;
	private meetingId: string | null = null;
	private source: MeetingPageSource = "calendar";
	private meetingData: MeetingPageData | null = null;
	/** PO-3 자료 수집 중 상태 (버튼 비활성화 / 스피너 표시용). */
	private collectingResources = false;

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

		if (this.plugin.settings.demoMode) {
			const cal = mockCalendarData.meetings.find((m) => m.id === this.meetingId);
			this.meetingData = getMeetingPageMock(this.meetingId, cal ? {
				title: cal.title,
				date: cal.date,
				time: cal.time,
				type: cal.type,
			} : undefined);
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
				onGenerateTopics={() =>
					this.meetingId
						? new AiTopicModal(this.app, {
								plugin: this.plugin,
								meetingId: this.meetingId,
							}).open()
						: undefined
				}
				onEditMinutes={() => void this.openMinutesInEditor()}
				onOpenTopic={(topicId) => void this.openTopic(topicId)}
				onCollectResources={() => void this.runCollectResources()}
				collectingResources={this.collectingResources}
			/>,
		);
	}

	/**
	 * PO-3 자료 자동 수집 사용자 트리거.
	 *
	 * - demoMode=true: mock 자료 2건을 meetingsService.appendResources 로 저장
	 * - demoMode=false: agentService.collectResources({meetingId}) 호출 후 결과를 appendResources
	 * - 진행 중에는 collectingResources=true 로 버튼 비활성화 + 스피너 표시
	 * - 결과 후 loadAndRender 로 자료 섹션 자동 갱신
	 */
	private async runCollectResources(): Promise<void> {
		if (!this.meetingId || this.collectingResources) return;
		const meetingId = this.meetingId;
		this.collectingResources = true;
		this.render();

		try {
			if (this.plugin.settings.demoMode) {
				const added = await this.plugin.meetingsService.appendResources(
					meetingId,
					MOCK_COLLECTED_RESOURCES.map((r) => ({ ...r })),
				);
				new Notice(`[DEMO] 자료 ${added.length}건 수집 완료`);
			} else {
				const result = await this.plugin.agentService.collectResources({
					meetingId,
				});
				const added = await this.plugin.meetingsService.appendResources(
					meetingId,
					result.resources.map((r) => ({
						topicId: r.topicId,
						title: r.title,
						summary: r.summary,
						sourceUrl: r.sourceUrl,
					})),
				);
				const failedNote =
					result.failedTopics.length > 0
						? ` · 실패 ${result.failedTopics.length}건`
						: "";
				new Notice(
					`자료 ${added.length}건 수집 완료 (전체 ${result.totalCollected}건)${failedNote}`,
				);
			}
		} catch (err) {
			new Notice(`자료 수집 실패: ${(err as Error).message}`);
		} finally {
			this.collectingResources = false;
			await this.loadAndRender();
		}
	}

	/**
	 * 회의록 .md 파일을 Obsidian 네이티브 에디터로 열기.
	 * VaultMeetingRepository와 동일한 경로 규칙: {projectRoot}/Meetings/{date}_{slug}.md
	 */
	/**
	 * 회의록 .md 파일을 Obsidian 네이티브 에디터로 열기.
	 * 파일이 없으면 새로 생성 후 오픈.
	 * 이미 열린 탭이 있으면 재사용.
	 */
	private async openMinutesInEditor(): Promise<void> {
		if (!this.meetingData) return;

		const { date, title } = this.meetingData;
		const slug = title
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^\w가-힣-]/g, "")
			.slice(0, 40);
		const root = this.plugin.settings.projectRoot;
		const filePath = `${root}/Meetings/${date}_${slug}.md`;

		let file = this.app.vault.getAbstractFileByPath(filePath) as TFile | null;
		if (!file) {
			// 파일이 없으면 새로 생성 (demoMode 포함)
			try {
				file = await this.app.vault.create(filePath, "");
			} catch {
				new Notice(`회의 파일 생성 실패: ${filePath}`);
				return;
			}
		}

		// 이미 열린 탭이 있으면 재사용
		const existing = this.app.workspace
			.getLeavesOfType("markdown")
			.find((leaf) => (leaf.view as MarkdownView).file?.path === filePath);
		if (existing) {
			this.app.workspace.revealLeaf(existing);
			return;
		}

		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.openFile(file);
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
