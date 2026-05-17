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
import { eventBus, type DomainEventName } from "./shared/repo/eventBus";
import { Notice } from "obsidian";
import type { InviteService } from "./features/team/services/inviteService";
import { LocalInviteService } from "./features/team/services/inviteService.local";
import { JoinProjectModal } from "./features/team/ui/JoinProjectModal";

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

		// ─── InviteService 주입 ───
		// 시연용: LocalInviteService (같은 컴퓨터 안에서만 동작)
		// 백엔드 합류 시: ServerInviteService 로 한 줄 교체
		//   this.inviteService = new ServerInviteService({ baseUrl, getAuthToken, getWorkspaceId });
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

		// ─── 초대 링크 protocol handler ─────────────────────────────
		// obsidian://pharos-join?token=xxx&workspace=yyy 클릭 시
		// 옵시디언이 자동 실행되면서 이 콜백 호출.
		// (회의 합의: 옵시디언 안쪽은 유석, 서버 통합은 경석)
		this.registerObsidianProtocolHandler("pharos-join", (params) => {
			void this.handleJoinLink(params.token ?? "");
		});

		// eventBus(새) ↔ workspace 이벤트 + settings.projectReport(구) 다리
		// — UI는 아직 settings.projectReport·"pharos:state-changed" 의존이라
		//   Service가 Vault에 저장한 뒤 이 다리가 settings 미러링 + 이벤트 발행
		this.setupEventBridge();
	}

	/**
	 * eventBus(도메인 이벤트) → settings 미러링 + "pharos:state-changed" 발행.
	 *
	 * Service가 Vault에 저장한 직후 호출돼서, 기존 UI(설정 의존)도 갱신되게 함.
	 * UI 전부가 Repository 기반으로 옮기면 이 다리 제거 가능.
	 */
	private setupEventBridge(): void {
		const syncProject = async (): Promise<void> => {
			const p = await this.projectService.get();
			if (p) {
				this.settings.projectReport = {
					name: p.name,
					description: p.description,
					deadline: p.deadline,
					fixedMeetingMode: p.fixedMeetingMode,
					fixedMeetingDay: p.fixedMeetingDay,
					fixedMeetingTime: p.fixedMeetingTime,
					createdAt: p.createdAt,
				};
				this.settings.planningRoadmapGenerated = p.planningRoadmapGenerated;
				this.settings.developmentRoadmapGenerated = p.developmentRoadmapGenerated;
			} else {
				this.settings.projectReport = null;
				this.settings.planningRoadmapGenerated = false;
				this.settings.developmentRoadmapGenerated = false;
			}
			await this.saveSettings();
		};

		// Project 관련: settings 미러링 + 이벤트 발행
		const projectEvents: DomainEventName[] = [
			"project:created",
			"project:updated",
			"project:reset",
			"roadmap:planning-generated",
			"roadmap:development-generated",
			"roadmap:development-deleted",
		];
		for (const evt of projectEvents) {
			const off = eventBus.on(evt, () => void syncProject());
			this.register(() => off.dispose());
		}

		// 그 외 도메인 이벤트: workspace.trigger만 호출 (UI 리렌더용)
		const triggerOnly: DomainEventName[] = [
			"meeting:created",
			"meeting:updated",
			"meeting:deleted",
			"minutes:attached",
			"task:created",
			"task:updated",
			"task:checked",
			"team:member-added",
			"team:member-removed",
		];
		for (const evt of triggerOnly) {
			const off = eventBus.on(evt, () => {
				this.app.workspace.trigger("pharos:state-changed");
			});
			this.register(() => off.dispose());
		}
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
	 * 시연/테스트용. projectReport·로드맵 플래그를 초기 상태로 리셋.
	 * 모든 뷰가 "프로젝트 없음" empty state로 돌아감.
	 */
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

	async resetProject(): Promise<void> {
		// Vault에 저장된 Project도 같이 삭제 (eventBus.emit("project:reset") 발행됨)
		try {
			await this.projectService.reset();
		} catch (err) {
			console.error("[Pharos] projectService.reset() 실패:", err);
		}
		// 구버전 settings 필드도 함께 초기화
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
