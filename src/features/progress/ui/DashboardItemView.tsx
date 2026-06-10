/**
 * DashboardItemView — DashboardView(React 컴포넌트)를 Obsidian ItemView로 감싸는 어댑터.
 *
 * 상태별 분기:
 *   1) projectReport === null              → 빈 Dashboard + "프로젝트 생성" CTA
 *   2) 프로젝트 있음 (로드맵 유무 무관)    → 실데이터 렌더
 *      - progressService.getTaskSummary()
 *      - meetingsService.list()  (다가오는 회의)
 *      - teamService.list()      (팀원 활동)
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { DashboardView } from "./DashboardView";
import { EmptyDashboardView } from "./EmptyDashboardView";
import { VIEW_TYPE_PHAROS_MY_TASKS } from "./MyTasksItemView";
import { VIEW_TYPE_PHAROS_PROGRESS } from "./ProgressPageItemView";
import { VIEW_TYPE_PHAROS_CALENDAR } from "../../meeting/ui/CalendarItemView";
import { VIEW_TYPE_PHAROS_MEETINGS_LIST } from "../../meeting/ui/MeetingsListItemView";
import { VIEW_TYPE_PHAROS_MEETING_PAGE } from "../../meeting/ui/MeetingPageItemView";
import { AiTopicModal } from "../../meeting/ui/AiTopicModal";
import { NewProjectModal } from "../../project/ui/NewProjectModal";
import { ProjectSettingsModal } from "../../project/ui/ProjectSettingsModal";
// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────────
// 연동 완료 후 이 import 줄을 삭제하세요.
import { mockDashboardData } from "./mock";
// ──────────────────────────────────────────────────────────────────────────────
import { VIEW_TYPE_PHAROS_ROADMAP } from "../../roadmap/ui/RoadmapItemView";
import { VIEW_TYPE_PHAROS_TEAM_LIST } from "../../team/ui/TeamListItemView";
import type { PharosPluginLike } from "../../../app/settings";
import type { Project } from "../../project/domain/projectSchema";
import type {
	DashboardData,
	DashboardAlert,
	ProgressAnalysisCard,
} from "../domain/dashboardData";

export const VIEW_TYPE_PHAROS_DASHBOARD = "pharos-dashboard-view";

const MOCK_PROGRESS_ANALYSIS: ProgressAnalysisCard = {
	loading: false,
	error: null,
	result: {
		asOf: new Date().toISOString().slice(0, 10),
		overallHealth: "on-track",
		summary:
			"전체 Task 의 약 절반이 완료되었고, 블로커는 없음. 다음 주 프로토타입 데드라인 직전 진행이 양호합니다.",
		insights: [
			{
				type: "milestone",
				message: "기획 로드맵 완료 · 개발 단계 진입",
			},
			{
				type: "achievement",
				message: "PM-3 체크리스트 완료율 64% 도달",
			},
			{
				type: "recommendation",
				message: "PO-12 검증 통과율 낮음 · 커밋-Task 매핑 확인 필요",
			},
		],
	},
};

export class DashboardItemView extends ItemView {
	private root: Root | null = null;
	/** PO-12 AI 진행 분석 카드 상태 (사용자 트리거 시에만 채워짐). */
	private progressAnalysis: ProgressAnalysisCard | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_DASHBOARD;
	}

	getDisplayText(): string {
		return "Pharos Dashboard";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
		void this.loadAndRender();

		this.registerEvent(
			this.app.workspace.on(
				"pharos:state-changed" as never,
				() => void this.loadAndRender(),
			),
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private async loadAndRender(): Promise<void> {
		if (!this.root) return;

		const project = await this.plugin.projectService.get();

		if (!project) {
			this.root.render(
				<EmptyDashboardView
					onCreateProject={() =>
						new NewProjectModal(this.app, this.plugin).open()
					}
				/>,
			);
			return;
		}

		// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────
		// 프로젝트 생성 후 실서비스 대신 mock 데이터로 대시보드를 렌더합니다.
		// 연동 완료 후 이 블록 전체(if 문 포함)를 삭제하세요.
		if (this.plugin.settings.demoMode) {
			this.root.render(
				<DashboardView
					data={{
						...mockDashboardData,
						project: {
							...mockDashboardData.project,
							name: project.name,
							deadline: project.deadline,
						},
						progressAnalysis:
							this.progressAnalysis ?? MOCK_PROGRESS_ANALYSIS,
					}}
					onOpenRoadmap={() => void this.openView(VIEW_TYPE_PHAROS_ROADMAP)}
					onOpenMeetings={() => void this.openView(VIEW_TYPE_PHAROS_MEETINGS_LIST)}
					onOpenMeeting={(id) => void this.openMeeting(id)}
					onOpenProgress={() => void this.openView(VIEW_TYPE_PHAROS_PROGRESS)}
					onOpenMyTasks={() => void this.openView(VIEW_TYPE_PHAROS_MY_TASKS)}
					onOpenCalendar={() => void this.openView(VIEW_TYPE_PHAROS_CALENDAR)}
					onOpenTeam={() => void this.openView(VIEW_TYPE_PHAROS_TEAM_LIST)}
					onGenerateMeetingTopics={() =>
						new AiTopicModal(this.app, { plugin: this.plugin }).open()
					}
					onOpenSettings={() =>
						new ProjectSettingsModal(this.app, this.plugin, {
							topic: project.name,
							description: project.description,
							deadline: project.deadline,
						}).open()
					}
					onAnalyzeProgress={() => void this.runProgressAnalysis()}
				/>,
			);
			return;
		}
		// ──────────────────────────────────────────────────────────────────────────────

		const data = await this.buildDashboardData(project);
		this.root.render(
			<DashboardView
				data={{
					...data,
					progressAnalysis:
						this.progressAnalysis ?? {
							loading: false,
							error: null,
							result: null,
						},
				}}
				onOpenRoadmap={() =>
					void this.openView(VIEW_TYPE_PHAROS_ROADMAP)
				}
				onOpenMeetings={() =>
					void this.openView(VIEW_TYPE_PHAROS_MEETINGS_LIST)
				}
				onOpenMeeting={(id) => void this.openMeeting(id)}
				onOpenProgress={() =>
					void this.openView(VIEW_TYPE_PHAROS_PROGRESS)
				}
				onOpenMyTasks={() =>
					void this.openView(VIEW_TYPE_PHAROS_MY_TASKS)
				}
				onOpenCalendar={() =>
					void this.openView(VIEW_TYPE_PHAROS_CALENDAR)
				}
				onOpenTeam={() =>
					void this.openView(VIEW_TYPE_PHAROS_TEAM_LIST)
				}
				onGenerateMeetingTopics={() =>
					new AiTopicModal(this.app, { plugin: this.plugin }).open()
				}
				onOpenSettings={() =>
					new ProjectSettingsModal(this.app, this.plugin, {
						topic: project.name,
						description: project.description,
						deadline: project.deadline,
					}).open()
				}
				onAnalyzeProgress={() => void this.runProgressAnalysis()}
			/>,
		);
	}

	/**
	 * PO-12 AI 진행 분석 사용자 트리거.
	 *
	 * 비싼 LLM 호출이라 자동 호출하지 않고 명시적 버튼으로만 진입.
	 * loading → 결과/에러 → 재렌더 사이클은 progressAnalysis 캐시 변수로 관리.
	 * demoMode 일 때도 실제 호출하지 않고 mock 으로 유지 (시연 안정성).
	 */
	private async runProgressAnalysis(): Promise<void> {
		if (this.plugin.settings.demoMode) {
			this.progressAnalysis = MOCK_PROGRESS_ANALYSIS;
			await this.loadAndRender();
			return;
		}

		this.progressAnalysis = { loading: true, error: null, result: null };
		await this.loadAndRender();

		try {
			const result = await this.plugin.agentService.analyzeProgress({});
			this.progressAnalysis = {
				loading: false,
				error: null,
				result: {
					asOf: result.asOf,
					overallHealth: result.overallHealth,
					summary: result.summary,
					insights: result.insights.map((i) => ({
						type: i.type,
						message: i.message,
					})),
				},
			};
		} catch (err) {
			this.progressAnalysis = {
				loading: false,
				error: (err as Error).message,
				result: null,
			};
		}
		await this.loadAndRender();
	}

	private async buildDashboardData(project: Project): Promise<DashboardData> {
		const today = new Date().toISOString().slice(0, 10);
		const deadlineDate = new Date(project.deadline + "T00:00:00");
		const todayDate = new Date();
		todayDate.setHours(0, 0, 0, 0);
		const daysLeft = Math.max(
			0,
			Math.round(
				(deadlineDate.getTime() - todayDate.getTime()) /
					(1000 * 60 * 60 * 24),
			),
		);

		const [taskSummary, meetings, members] = await Promise.all([
			this.plugin.progressService.getTaskSummary(),
			this.plugin.meetingsService.list(),
			this.plugin.teamService.list(),
		]);

		const upcomingMeetings = meetings
			.filter((m) => m.date >= today && m.status !== "completed")
			.sort(
				(a, b) =>
					a.date.localeCompare(b.date) ||
					a.time.localeCompare(b.time),
			)
			.slice(0, 3)
			.map((m) => ({ id: m.id, date: m.date, time: m.time, title: m.title }));

		const alerts: DashboardAlert[] = [];
		if (taskSummary.blocked > 0) {
			alerts.push({
				severity: "warning",
				text: `블로커 Task ${taskSummary.blocked}건이 있습니다.`,
			});
		}
		if (
			!project.planningRoadmapGenerated &&
			!project.developmentRoadmapGenerated
		) {
			alerts.push({
				severity: "info",
				text: "기획 로드맵이 아직 없습니다. Roadmap 탭에서 생성해주세요.",
			});
		}

		return {
			project: {
				name: project.name,
				deadline: project.deadline,
				daysUntilPrototype: null,
				totalDays: daysLeft,
			},
			progress: {
				totalTasks: taskSummary.total,
				completedTasks: taskSummary.done,
				thisWeekCommits: 0,
			},
			prototypeProgress: null,
			developmentProgress: {
				percent: taskSummary.completionRate,
				dday: daysLeft,
			},
			myTasks: {
				inProgress: taskSummary.inProgress,
				total: taskSummary.total,
				memberName:
					members.find((m) => m.status === "active")?.name ?? "나",
			},
			members: members.map((m) => ({
				id: m.id,
				name: m.name,
				role: m.role,
				checks: 0,
				commits: 0,
			})),
			meetings: upcomingMeetings,
			importantDates: [
				{ label: "최종 마감", date: project.deadline, dday: daysLeft },
			],
			alerts,
		};
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
	 * 특정 회의 페이지로 이동.
	 * MeetingPageItemView·setState({ meetingId, source }) 패턴은 캘린더·회의 목록·
	 * 회의록 관리에서 이미 동일하게 사용 중이므로 새 인프라 추가 없이 재사용한 것.
	 * source를 "meetings-list"로 고정해 회의 페이지의 뒤로가기가 회의 목록으로 돌아가도록 한다.
	 * 실서비스 연동 시에도 buildDashboardData가 meetingsService.list()의 id를 그대로
	 * 전달하므로 이 메서드는 수정 없이 동작한다.
	 */
	private async openMeeting(meetingId: string): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace
			.getLeavesOfType(VIEW_TYPE_PHAROS_MEETING_PAGE)
			.find((leaf) => {
				const s = leaf.getViewState().state as { meetingId?: string } | undefined;
				return s?.meetingId === meetingId;
			});
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_PHAROS_MEETING_PAGE,
			state: { meetingId, source: "meetings-list" },
			active: true,
		});
	}
}
