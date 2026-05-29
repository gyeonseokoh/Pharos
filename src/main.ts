import { Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	PharosSettingsTab,
	type PharosSettings,
} from "./app/settings";
import {
	DashboardItemView,
	VIEW_TYPE_PHAROS_DASHBOARD,
} from "./features/progress/ui/DashboardItemView";
import {
	MyTasksItemView,
	VIEW_TYPE_PHAROS_MY_TASKS,
} from "./features/progress/ui/MyTasksItemView";
import {
	ProgressPageItemView,
	VIEW_TYPE_PHAROS_PROGRESS,
} from "./features/progress/ui/ProgressPageItemView";
import {
	CalendarItemView,
	VIEW_TYPE_PHAROS_CALENDAR,
} from "./features/meeting/ui/CalendarItemView";
import {
	MeetingPageItemView,
	VIEW_TYPE_PHAROS_MEETING_PAGE,
} from "./features/meeting/ui/MeetingPageItemView";
import {
	MeetingsListItemView,
	VIEW_TYPE_PHAROS_MEETINGS_LIST,
} from "./features/meeting/ui/MeetingsListItemView";
import {
	MinutesArchiveItemView,
	VIEW_TYPE_PHAROS_MINUTES_ARCHIVE,
} from "./features/meeting/ui/MinutesArchiveItemView";
import {
	TopicPageItemView,
	VIEW_TYPE_PHAROS_TOPIC_PAGE,
} from "./features/meeting/ui/TopicPageItemView";
import {
	TaskDetailItemView,
	VIEW_TYPE_PHAROS_TASK_DETAIL,
} from "./features/task/ui/TaskDetailItemView";
import {
	TeamListItemView,
	VIEW_TYPE_PHAROS_TEAM_LIST,
} from "./features/team/ui/TeamListItemView";
import {
	RoadmapItemView,
	VIEW_TYPE_PHAROS_ROADMAP,
} from "./features/roadmap/ui/RoadmapItemView";
import { VaultProjectRepository } from "./features/project/repositories/projectRepository.vault";
import { ProjectService } from "./features/project/services/projectService";
import type { ProjectRepository } from "./features/project/repositories/projectRepository";
import { VaultMeetingRepository } from "./features/meeting/repositories/meetingRepository.vault";
import { MeetingsService } from "./features/meeting/services/meetingsService";
import type { MeetingRepository } from "./features/meeting/repositories/meetingRepository";
import { VaultTaskRepository } from "./features/task/repositories/taskRepository.vault";
import type { TaskRepository } from "./features/task/repositories/taskRepository";
import { TaskService } from "./features/task/services/taskService";
import { VaultRoadmapRepository } from "./features/roadmap/repositories/roadmapRepository.vault";
import type { RoadmapRepository } from "./features/roadmap/repositories/roadmapRepository";
import { RoadmapService } from "./features/roadmap/services/roadmapService";
import { VaultTeamRepository, VaultInviteRepository } from "./features/team/repositories/teamRepository.vault";
import type { TeamRepository, InviteRepository } from "./features/team/repositories/teamRepository";
import { TeamService } from "./features/team/services/teamService";
import { ProgressService } from "./features/progress/services/progressService";
import { VaultAvailabilityRepository } from "./features/availability/repositories/availabilityRepository.vault";
import type { AvailabilityRepository } from "./features/availability/repositories/availabilityRepository";
import { AvailabilityService } from "./features/availability/services/availabilityService";
import { VaultCommitRepository } from "./features/commit/repositories/commitRepository.vault";
import type { CommitRepository } from "./features/commit/repositories/commitRepository";
import { CommitService } from "./features/commit/services/commitService";
import { runMigrationIfNeeded } from "./app/migration";
import { Notice } from "obsidian";
import type { InviteService } from "./features/team/services/inviteService";
import { LocalInviteService } from "./features/team/services/inviteService.local";
import { JoinProjectModal } from "./features/team/ui/JoinProjectModal";
import { WeeklyAvailabilityModal } from "./features/team/ui/WeeklyAvailabilityModal";
import { AgentService } from "./features/agent/services/agentService";
import { GeminiProvider } from "./features/agent/providers/GeminiProvider";
import { TavilySearchProvider } from "./features/agent/search/TavilySearchProvider";

export default class PharosPlugin extends Plugin {
	settings: PharosSettings = { ...DEFAULT_SETTINGS };

	// ─── Repositories ───
	projectRepository!: ProjectRepository;
	meetingRepository!: MeetingRepository;
	taskRepository!: TaskRepository;
	roadmapRepository!: RoadmapRepository;
	teamRepository!: TeamRepository;
	inviteRepository!: InviteRepository;
	availabilityRepository!: AvailabilityRepository;
	commitRepository!: CommitRepository;

	// ─── Services ───
	projectService!: ProjectService;
	meetingsService!: MeetingsService;
	taskService!: TaskService;
	roadmapService!: RoadmapService;
	teamService!: TeamService;
	progressService!: ProgressService;
	availabilityService!: AvailabilityService;
	commitService!: CommitService;
	inviteService!: InviteService;
	agentService!: AgentService;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Repository·Service 레이어 초기화 (UI 등록 전)
		// 2단계: VaultRepository — .md 파일 기반 저장
		// 3단계 교체 시: Vault → Hocuspocus 구현체로 한 줄만 바꾸면 됨
		this.projectRepository = new VaultProjectRepository(this);
		this.projectService = new ProjectService(this.projectRepository);
		this.meetingRepository = new VaultMeetingRepository(this);
		this.meetingsService = new MeetingsService(this.meetingRepository);
		this.taskRepository = new VaultTaskRepository(this);
		this.roadmapRepository = new VaultRoadmapRepository(this);
		this.teamRepository = new VaultTeamRepository(this);
		this.inviteRepository = new VaultInviteRepository(this);
		this.availabilityRepository = new VaultAvailabilityRepository(this);
		this.commitRepository = new VaultCommitRepository(this);
		this.taskService = new TaskService(this.taskRepository);
		this.availabilityService = new AvailabilityService(this.availabilityRepository);
		this.commitService = new CommitService(this.commitRepository);
		this.roadmapService = new RoadmapService(this.roadmapRepository);
		this.teamService = new TeamService(this.teamRepository, this.inviteRepository);
		this.progressService = new ProgressService(this.taskRepository);
		const llmProvider = new GeminiProvider(() => this.settings.llmApikey, this.settings.llmModel);
		const searchProvider = new TavilySearchProvider(() => this.settings.tavilyApiKey);
		this.agentService = new AgentService(
			this.teamService,
			this.availabilityService,
			this.meetingsService,
			this.progressService,
			this.taskService,
			this.roadmapService,
			llmProvider,
			searchProvider,
		);

		// ─── InviteService 주입 ───
		// 시연용: LocalInviteService (같은 컴퓨터 안에서만 동작)
		// 백엔드 합류 시: ServerInviteService 로 한 줄 교체
		//   this.inviteService = new ServerInviteService({ baseUrl, duthToken, getWorkspaceId });
		this.inviteService = new LocalInviteService({
			inviteRepo: this.inviteRepository,
			getWorkspaceId: async () => {
				const p = await this.projectService.get();
				return p?.workspaceId ?? null;
			},
		});

		// 마이그레이션: data.json → .md (최초 1회, 사용자 동의 후 실행)
		// onload 안에서 await 하면 옵시디언 부팅이 모달 대기로 멈춤 → onLayoutReady 후 비동기 실행
		this.app.workspace.onLayoutReady(() => {
			void runMigrationIfNeeded(this);
		});

		// 뷰 타입 등록 — 모든 ItemView에 plugin 인스턴스 주입해서
		// this.plugin.settings 읽고 saveSettings() 호출 가능하게 함.
		this.registerView(
			VIEW_TYPE_PHAROS_DASHBOARD,
			(leaf) => new DashboardItemView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_ROADMAP,
			(leaf) => new RoadmapItemView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_PROGRESS,
			(leaf) => new ProgressPageItemView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_MY_TASKS,
			(leaf) => new MyTasksItemView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_CALENDAR,
			(leaf) => new CalendarItemView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_MEETING_PAGE,
			(leaf) => new MeetingPageItemView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_MEETINGS_LIST,
			(leaf) => new MeetingsListItemView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_TOPIC_PAGE,
			(leaf) => new TopicPageItemView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_MINUTES_ARCHIVE,
			(leaf) => new MinutesArchiveItemView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_TEAM_LIST,
			(leaf) => new TeamListItemView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_PHAROS_TASK_DETAIL,
			(leaf) => new TaskDetailItemView(leaf, this),
		);

		// Ribbon 아이콘
		this.addRibbonIcon("layout-dashboard", "Pharos Dashboard", () => {
			void this.activateView(VIEW_TYPE_PHAROS_DASHBOARD);
		});

		// 명령 팔레트
		this.addCommand({
			id: "open-dashboard",
			name: "Open Pharos Dashboard",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_DASHBOARD),
		});
		this.addCommand({
			id: "open-roadmap",
			name: "Open Pharos Roadmap",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_ROADMAP),
		});
		this.addCommand({
			id: "open-progress",
			name: "Open Team Progress",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_PROGRESS),
		});
		this.addCommand({
			id: "open-my-tasks",
			name: "Open My Tasks",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_MY_TASKS),
		});
		this.addCommand({
			id: "open-calendar",
			name: "Open Pharos Calendar",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_CALENDAR),
		});
		this.addCommand({
			id: "open-meetings",
			name: "Open Meetings List",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_MEETINGS_LIST),
		});
		this.addCommand({
			id: "open-team-list",
			name: "Open Team List",
			callback: () => void this.activateView(VIEW_TYPE_PHAROS_TEAM_LIST),
		});
		this.addCommand({
			id: "open-minutes-archive",
			name: "Open Minutes Management",
			callback: () =>
				void this.activateView(VIEW_TYPE_PHAROS_MINUTES_ARCHIVE),
		});

		// 시연/테스트용 초기화 — projectReport·로드맵 플래그 전부 리셋
		this.addCommand({
			id: "reset-project",
			name: "Pharos: Reset Project (test)",
			callback: () => void this.resetProject(),
		});

		// 설정 탭 등록
		this.addSettingTab(new PharosSettingsTab(this.app, this));

		// ─── PM-2 주간 가용시간 알림 스케줄러 ────────────────────────────
		// 시나리오.md PM-2: "매주 토요일 09시 알림 → 다음 주 가용시간 입력"
		// 매분 체크하다가 설정된 요일·시각에 도달하면 WeeklyAvailabilityModal 오픈.
		// currentMemberId가 없으면 스킵 (JoinProjectModal 가입 후 설정됨).
		// weeklyReminderLastShown으로 같은 날 중복 오픈 방지.
		this.registerInterval(
			window.setInterval(() => void this.checkWeeklyReminder(), 60_000),
		);

		// ─── 초대 링크 protocol handler ─────────────────────────────
		// obsidian://pharos-join?token=xxx&workspace=yyy 클릭 시
		// 옵시디언이 자동 실행되면서 이 콜백 호출.
		// (회의 합의: 옵시디언 안쪽은 유석, 서버 통합은 경석)
		this.registerObsidianProtocolHandler("pharos-join", (params) => {
			void this.handleJoinLink(params.token ?? "");
		});
	}

	async onunload(): Promise<void> {
		// 플러그인 비활성 시 열린 탭 정리 (선택)
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<PharosSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// 열려있는 모든 뷰가 상태 변화 감지해서 리렌더하도록 이벤트 발행
		this.app.workspace.trigger("pharos:state-changed");
	}

	/**
	 * 초대 링크 클릭 시 호출되는 핸들러.
	 * 토큰 검증 → 유효하면 JoinProjectModal 오픈.
	 */
	private async handleJoinLink(token: string): Promise<void> {
		if (!token) {
			new Notice("초대 링크에 토큰이 없습니다");
			return;
		}
		const invite = await this.inviteService.verifyToken(token);
		if (!invite) {
			new Notice("초대 링크가 유효하지 않거나 만료되었습니다 (24h)");
			return;
		}
		new JoinProjectModal(this.app, this, { token }).open();
	}

	/**
	 * PM-2 주간 가용시간 알림 체크.
	 * registerInterval(60s)로 매분 호출됨.
	 *
	 * 동작 조건 (모두 충족해야 모달 오픈):
	 *   1) currentMemberId 설정돼 있음 (JoinProjectModal 가입 완료 후)
	 *   2) 오늘이 settings.weeklyReminderDay (기본: 토요일 = 6)
	 *   3) 현재 시각 >= settings.weeklyReminderTime (기본: "09:00")
	 *   4) 오늘 아직 한 번도 띄우지 않음 (weeklyReminderLastShown !== today)
	 *
	 * 시나리오.md §8 데이터 흐름:
	 *   PM-2 입력 → Availability/*.md → availabilityService.findCommonSlots()
	 *              → PO-4 임시 회의 시간 후보 (AI 연동 후 mockCandidates 교체)
	 */
	private async checkWeeklyReminder(): Promise<void> {
		const { currentMemberId, weeklyReminderDay, weeklyReminderTime, weeklyReminderLastShown } =
			this.settings;

		// currentMemberId 없으면 아직 가입 전 — 스킵
		if (!currentMemberId) return;

		const now = new Date();
		const today = now.toISOString().slice(0, 10);

		// 오늘 요일 확인 (0=일 ~ 6=토)
		if (now.getDay() !== weeklyReminderDay) return;

		// 설정된 시각 이후인지 확인
		const [rh, rm] = weeklyReminderTime.split(":").map(Number);
		const reminderMinutes = (rh ?? 9) * 60 + (rm ?? 0);
		const nowMinutes = now.getHours() * 60 + now.getMinutes();
		if (nowMinutes < reminderMinutes) return;

		// 오늘 이미 띄웠으면 스킵
		if (weeklyReminderLastShown === today) return;

		// 조건 충족 → 모달 오픈 + 오늘 날짜 기록
		this.settings.weeklyReminderLastShown = today;
		await this.saveSettings();

		new WeeklyAvailabilityModal(this.app, {
			plugin: this,
			memberId: currentMemberId,
		}).open();
	}

	/**
	 * 시연/테스트용. projectReport·로드맵 플래그를 초기 상태로 리셋.
	 * 모든 뷰가 "프로젝트 없음" empty state로 돌아감.
	 */
	async resetProject(): Promise<void> {
		this.settings.projectReport = null;
		this.settings.planningRoadmapGenerated = false;
		this.settings.developmentRoadmapGenerated = false;
		this.settings.developmentRoadmap = null;
		this.settings.attachedMinutes = {};
		this.settings.roadmaps = {};
		await this.saveSettings();
	}

	/**
	 * 지정한 뷰 타입의 탭이 이미 있으면 포커스, 없으면 새 탭으로 오픈.
	 */
	async activateView(viewType: string): Promise<void> {
		const { workspace } = this.app;

		const [existing] = workspace.getLeavesOfType(viewType);
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}

		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: viewType,
			active: true,
		});
	}
}
