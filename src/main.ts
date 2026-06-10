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
import { Notice, MarkdownView } from "obsidian";
import type { InviteService, VerifiedInvite } from "./features/team/services/inviteService";
import { LocalInviteService } from "./features/team/services/inviteService.local";
import { ServerInviteService } from "features/team/services/inviteService.server";
import { JoinProjectModal } from "./features/team/ui/JoinProjectModal";
import { AgentService } from "./features/agent/services/agentService";
import { GeminiProvider } from "./features/agent/providers/GeminiProvider";
import { ConnectionManager } from "./shared/infra/sync/ConnectionManager";
import { SyncChannelManager } from "./shared/infra/sync/SyncChannelManager";
import { DocumentSync } from "./shared/infra/sync/DocumentSync";
import { shouldSync } from "./shared/infra/sync/syncFilter";
import { TavilySearchProvider } from "./features/agent/search/TavilySearchProvider";
import { BatchSyncService } from "./shared/infra/sync/BatchSyncService";
import { eventBus } from "./shared/repo/eventBus";

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

	// ─── 동기화 인프라 ──────────────────────────────────────────────────────
	connectionManager:  ConnectionManager  = new ConnectionManager();
	syncChannelManager: SyncChannelManager = new SyncChannelManager();
	/** documentName → DocumentSync. 열린 파일 추적용 */
	private syncMap = new Map<string, DocumentSync>();

	async onload(): Promise<void> {
		await this.loadSettings();

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
		const llmProvider = new GeminiProvider(() => this.settings.llmApikey, () => this.settings.llmModel || "gemini-2.0-flash");
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

		this.inviteService = new ServerInviteService({
			baseUrl: () => this.settings.hocuspocusServerUrl,
			getAuthToken: () => this.settings.authToken || null,
			getWorkspaceId: async () => this.settings.workspaceId ?? null
		})

		// eventBus → pharos:state-changed 브릿지
		// 내부 이벤트를 모든 View가 수신하도록 전파
		const triggerStateChanged = () => {
			this.app.workspace.trigger("pharos:state-changed");
		};
		eventBus.on("project:created", triggerStateChanged);
		eventBus.on("project:reset", triggerStateChanged);
		eventBus.on("meeting:created", triggerStateChanged);
		eventBus.on("meeting:updated", triggerStateChanged);
		eventBus.on("minutes:attached", triggerStateChanged);
		eventBus.on("roadmap:planning-generated", triggerStateChanged);
		eventBus.on("roadmap:development-generated", triggerStateChanged);
		eventBus.on("roadmap:development-deleted", triggerStateChanged);
		eventBus.on("task:created", triggerStateChanged);
		eventBus.on("task:updated", triggerStateChanged);
		eventBus.on("task:checked", triggerStateChanged);
		eventBus.on("team:member-added", triggerStateChanged);
		eventBus.on("team:member-removed", triggerStateChanged);

		this.app.workspace.onLayoutReady(() => {
			void runMigrationIfNeeded(this);

			// 동기화 초기화 (인증 정보가 이미 있을 때만 연결)
			this.reconnectSync();

			// ─── 파일 열기 → DocumentSync 바인딩 ──────────────────────
			this.registerEvent(
				this.app.workspace.on("file-open", (file) => {
					if (!file) return;
					if (!this.settings.workspaceId) return;
					if (!shouldSync(file.path, this.settings.syncIgnorePatterns)) return;

					const documentName = `${this.settings.workspaceId}/${file.path}`;

					if (this.syncMap.has(documentName)) return;

					const sync = new DocumentSync(documentName, this.connectionManager);
					this.syncMap.set(documentName, sync);

					const view = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (view) sync.bindEditor(view);
				}),
			);

			// ─── 레이아웃 변경 → 닫힌 파일 DocumentSync 해제 ──────────
			this.registerEvent(
				this.app.workspace.on("layout-change", () => {
					if (!this.settings.workspaceId) return;

					const openDocs = new Set<string>();
					this.app.workspace.iterateAllLeaves((leaf) => {
						const view = leaf.view;
						if (!(view instanceof MarkdownView)) return;
						const file = view.file;
						if (!file) return;
						openDocs.add(`${this.settings.workspaceId}/${file.path}`);
					});

					for (const [docName, sync] of this.syncMap) {
						if (!openDocs.has(docName)) {
							sync.destroy();
							this.syncMap.delete(docName);
							console.log(`[Pharos] sync released: ${docName}`);
						}
					}
				}),
			);
		});

		this.registerView(VIEW_TYPE_PHAROS_DASHBOARD,    (leaf) => new DashboardItemView(leaf, this));
		this.registerView(VIEW_TYPE_PHAROS_ROADMAP,      (leaf) => new RoadmapItemView(leaf, this));
		this.registerView(VIEW_TYPE_PHAROS_PROGRESS,     (leaf) => new ProgressPageItemView(leaf, this));
		this.registerView(VIEW_TYPE_PHAROS_MY_TASKS,     (leaf) => new MyTasksItemView(leaf, this));
		this.registerView(VIEW_TYPE_PHAROS_CALENDAR,     (leaf) => new CalendarItemView(leaf, this));
		this.registerView(VIEW_TYPE_PHAROS_MEETING_PAGE, (leaf) => new MeetingPageItemView(leaf, this));
		this.registerView(VIEW_TYPE_PHAROS_MEETINGS_LIST,(leaf) => new MeetingsListItemView(leaf, this));
		this.registerView(VIEW_TYPE_PHAROS_TOPIC_PAGE,   (leaf) => new TopicPageItemView(leaf, this));
		this.registerView(VIEW_TYPE_PHAROS_MINUTES_ARCHIVE, (leaf) => new MinutesArchiveItemView(leaf, this));
		this.registerView(VIEW_TYPE_PHAROS_TEAM_LIST,    (leaf) => new TeamListItemView(leaf, this));
		this.registerView(VIEW_TYPE_PHAROS_TASK_DETAIL,  (leaf) => new TaskDetailItemView(leaf, this));

		this.addRibbonIcon("layout-dashboard", "Pharos Dashboard", () => {
			void this.activateView(VIEW_TYPE_PHAROS_DASHBOARD);
		});

		this.addCommand({ id: "open-dashboard",       name: "Open Pharos Dashboard",    callback: () => void this.activateView(VIEW_TYPE_PHAROS_DASHBOARD) });
		this.addCommand({ id: "open-roadmap",          name: "Open Pharos Roadmap",      callback: () => void this.activateView(VIEW_TYPE_PHAROS_ROADMAP) });
		this.addCommand({ id: "open-progress",         name: "Open Team Progress",       callback: () => void this.activateView(VIEW_TYPE_PHAROS_PROGRESS) });
		this.addCommand({ id: "open-my-tasks",         name: "Open My Tasks",            callback: () => void this.activateView(VIEW_TYPE_PHAROS_MY_TASKS) });
		this.addCommand({ id: "open-calendar",         name: "Open Pharos Calendar",     callback: () => void this.activateView(VIEW_TYPE_PHAROS_CALENDAR) });
		this.addCommand({ id: "open-meetings",         name: "Open Meetings List",       callback: () => void this.activateView(VIEW_TYPE_PHAROS_MEETINGS_LIST) });
		this.addCommand({ id: "open-team-list",        name: "Open Team List",           callback: () => void this.activateView(VIEW_TYPE_PHAROS_TEAM_LIST) });
		this.addCommand({ id: "open-minutes-archive",  name: "Open Minutes Management",  callback: () => void this.activateView(VIEW_TYPE_PHAROS_MINUTES_ARCHIVE) });
		this.addCommand({ id: "reset-project",         name: "Pharos: Reset Project (test)", callback: () => void this.resetProject() });

		this.addSettingTab(new PharosSettingsTab(this.app, this));

		this.registerObsidianProtocolHandler("pharos-join", (params) => {
			void this.handleJoinLink(params.token ?? "");
		});

		this.registerObsidianProtocolHandler("pharos-callback", (params) => {
			void this.handleAuthCallback(params.token ?? "");
		});
	}

	async onunload(): Promise<void> {
		for (const sync of this.syncMap.values()) {
			sync.destroy();
		}
		this.syncMap.clear();
		this.syncChannelManager.destroy();
		this.connectionManager.destroyAll();
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<PharosSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.app.workspace.trigger("pharos:state-changed");
	}

	private async handleJoinLink(token: string): Promise<void> {
		if (!token) { new Notice("초대 링크에 토큰이 없습니다"); return; }
		let invite: VerifiedInvite | null;
		try {
			invite = await this.inviteService.verifyToken(token);
		} catch (err) {
			new Notice(`초대 링크 확인 실패: ${(err as Error).message}`);
			return;
		}
		if (!invite) { new Notice("초대 링크가 만료됐거나 이미 사용됐습니다"); return; }
		new JoinProjectModal(this.app, this, { token, permission: invite.permission }).open();
	}

	private async handleAuthCallback(token: string): Promise<void> {
		if (!token) { new Notice("❌ 로그인 실패: 토큰이 없습니다"); return; }

		let login: string;
		try {
			const parts = token.split(".");
			if (parts.length < 3 || !parts[1]) {
				new Notice("❌ 로그인 실패: 올바르지 않은 토큰 형식");
				return;
			}
			const base64 = parts[1]
				.replace(/-/g, "+")
				.replace(/_/g, "/")
				.padEnd(parts[1].length + (4 - (parts[1].length % 4)) % 4, "=");
			login = (JSON.parse(atob(base64)) as { login?: string }).login ?? "";
		} catch {
			new Notice("❌ 로그인 실패: 토큰 파싱 오류");
			return;
		}

		this.settings.authToken   = token;
		this.settings.githubLogin = login;
		await this.saveSettings();

		// 로그인 완료 -> 동기화 재초기화
		this.reconnectSync();

		new Notice(`✅ GitHub 로그인 성공: @${login}`);
	}

	/**
	 * 동기화 인프라 초기화.
	 * onLayoutReady / handleAuthCallback 두 진입점에서 호출.
	 * 인증 토큰 또는 workspaceId 없으면 조용히 종료.
	 * 
	 * 2026-6-7 의미론적으로 재사용이 빈번한 탓에 의미론적으로 어울리게 reconnect로 변경함
	 */
	reconnectSync(): void {
		const { authToken, workspaceId, hocuspocusServerUrl } = this.settings;
		if (!authToken || !workspaceId || !hocuspocusServerUrl) {
			console.log("[Pharos] initSync: 인증 정보 부족 — 동기화 생략");
			return;
		}
		this.connectionManager.setServerUrl(hocuspocusServerUrl);
		this.connectionManager.setToken(authToken);

		this.syncChannelManager.setOnTrigger((payload) => {
			console.log(`[Pharos] agent trigger: event=${payload.event}`);
			// TODO: void this.agentService.run(payload.event);
		});
		this.syncChannelManager.init(hocuspocusServerUrl, workspaceId, authToken);

		console.log(`[Pharos] initSync: workspace=${workspaceId} server=${hocuspocusServerUrl}`);

		void new BatchSyncService().run(this); // Vault 전체 일괄 동기화
	}

	async resetProject(): Promise<void> {
		this.settings.projectReport = null;
		this.settings.planningRoadmapGenerated = false;
		this.settings.developmentRoadmapGenerated = false;
		this.settings.developmentRoadmap = null;
		this.settings.attachedMinutes = {};
		this.settings.roadmaps = {};
		await this.saveSettings();
	}

	async activateView(viewType: string): Promise<void> {
		const { workspace } = this.app;
		const [existing] = workspace.getLeavesOfType(viewType);
		if (existing) { workspace.revealLeaf(existing); return; }
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({ type: viewType, active: true });
	}
}