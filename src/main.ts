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

		// 마이그레이션: data.json → .md (최초 1회, 사용자 동의 후 실행)
		await runMigrationIfNeeded(this);

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
