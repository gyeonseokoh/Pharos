/**
 * Pharos 플러그인 전역 설정 (Obsidian Settings Tab).
 *
 * API 키, 프로젝트 경로, 동기화 옵션 등.
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type { Plugin } from "obsidian";
import type { RoadmapData } from "../features/roadmap/domain/roadmapData";
import type { Roadmap } from "../features/roadmap/domain/roadmapSchema";
import type { Task } from "../features/task/domain/taskSchema";
import type { Member, Invite } from "../features/team/domain/teamSchema";
import type {
	MeetingAnalysis,
	MeetingMinutes,
} from "../features/meeting/domain/meetingPageData";
import type { Availability } from "../features/availability/domain/availabilitySchema";
import type { CommitBatch } from "../features/commit/domain/commitSchema";
import { AgentService } from "../features/agent/services/agentService";
import { GeminiProvider } from "features/agent/providers/GeminiProvider";
import { TavilySearchProvider } from "features/agent/search/TavilySearchProvider";

// 상수
const SERVER_HTTP_URL = "https://pharos-backend.onrender.com"

/**
 * PO-5 업로드로 저장된 회의록 + 분석 결과.
 * key = meetingId (meetingPageMocks의 id). mock 회의에 덧씌워 렌더됨.
 */
export interface AttachedMinute {
	minutes: MeetingMinutes;
	analysis: MeetingAnalysis;
}

/**
 * NewProjectModal이 제출한 프로젝트 보고서.
 * 나중에 실제 AI가 생기면 이걸 입력으로 받아 로드맵·Task 등을 생성.
 */
export interface ProjectReport {
	name: string;
	description: string;
	deadline: string; // ISO date
	fixedMeetingMode: "auto" | "manual";
	fixedMeetingDay?: number; // 0-6, manual일 때
	fixedMeetingTime?: string; // HH:MM, manual일 때
	createdAt: string; // ISO timestamp
}

export interface PharosSettings {
	// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 플래그 ──────────────────────
	// true = 각 ItemView가 서비스 대신 하드코딩 mock 데이터를 렌더합니다.
	// AI·서버·깃허브 연동 완료 후 이 필드와 관련 분기를 모두 삭제하세요.
	demoMode: boolean;
	// ──────────────────────────────────────────────────────────────────────────────

	/** Vault 내 프로젝트 루트 경로. 기본 "Pharos". */
	projectRoot: string;
	/** LLM API 키 (로컬 저장). */
	llmApikey: string;
	llmModel: string; // 테스트용
	/** GitHub Personal Access Token. */
	githubToken: string;
	/** GitHub 레포 URL (예: "owner/repo"). */
	githubRepo: string;
	/** Tavily API 키. */
	tavilyApiKey: string;
	/** 커밋 컨벤션 정규식 (기본: feat|fix(TASK-XXX)). */
	commitPattern: string;
	/** 진행도 페이지 자동 갱신 시각 (HH:MM, KST). */
	dailyDigestTime: string;
	/** 주간 가용시간 알림 발송 요일/시간. */
	weeklyReminderDay: number; // 0-6
	weeklyReminderTime: string;
	/** 서버 연결 (v2). 비어있으면 로컬 전용. */
	hocuspocusServerUrl: string;

	// ─── 프로젝트 상태 (시나리오 플로우) ───
	/** NewProjectModal 제출 결과. null = 초기 빈 상태. */
	projectReport: ProjectReport | null;
	/** PO-1 기획 로드맵 생성 여부. 탭·mock 활성화 트리거. */
	planningRoadmapGenerated: boolean;
	/** PO-6 개발 로드맵 생성 여부. 개발 탭 활성화 + 기본 탭 전환. */
	developmentRoadmapGenerated: boolean;
	/**
	 * PO-6 자동 생성 모달에서 승인된 개발 로드맵 데이터.
	 * developmentRoadmapGenerated === true 일 때만 사용.
	 * null이면 render 시 mock으로 fallback.
	 * @deprecated RoadmapRepository.getByType("DEVELOPMENT") 로 대체 예정
	 */
	developmentRoadmap: RoadmapData | null;
	/**
	 * PO-5 업로드된 회의록 + 분석 결과.
	 * key = meetingId. mock 회의에 minutes가 없을 때 덧씌워 렌더.
	 */
	attachedMinutes: Record<string, AttachedMinute>;

	// ─── 엔티티 저장소 (SettingsRepository 1단계) ───
	/** Task 엔티티 목록. TaskRepository 1단계 저장소. */
	tasks: Task[];
	/** 다음 Task 번호 (TASK-<n> 자동 증가). */
	taskNextId: number;
	/** 로드맵 엔티티. key = "PLANNING" | "DEVELOPMENT". RoadmapRepository 1단계 저장소. */
	roadmaps: Record<string, Roadmap>;
	/** 팀원 엔티티 목록. TeamRepository 1단계 저장소. */
	members: Member[];
	/** 초대 엔티티 목록. InviteRepository 1단계 저장소. */
	invites: Invite[];
	/** 주간 가용시간 엔티티 목록. AvailabilityRepository 1단계 저장소. */
	availabilities: Availability[];
	/** GitHub 커밋 배치 목록 (월별). CommitRepository 1단계 저장소. */
	commitBatches: CommitBatch[];
	/**
	 * data.json → Vault .md 마이그레이션 완료 여부.
	 * true 이면 VaultRepository 사용 중. false/undefined 이면 SettingsRepository 사용.
	 */
	migrated: boolean;

	// ─── 서버 인증 & 동기화 ───
	/**
	 * 서버가 발급한 JWT. 빈 문자열이면 미인증 상태.
	 * GitHub Access Token은 절대 여기에 저장하지 않음 (서버 전용).
	 */
	authToken: string;
	/** JWT에서 decode한 GitHub 로그인명. UI 표시용. */
	githubLogin: string;
	/**
	 * 서버 DB의 workspaces.id.
	 * null이면 워크스페이스 미등록 (로컬 전용 모드).
	 */
	workspaceId: number | null;
	/**
	 * 동기화 제외 패턴 목록. syncFilter.ts가 해석.
	 * 예: ["**\/.obsidian\/**", "*.tmp"]
	 */
	syncIgnorePatterns: string[];
}

export const DEFAULT_SETTINGS: PharosSettings = {
	// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 기본값 ────────────────────────
	// 연동 완료 후 이 줄과 위 인터페이스의 demoMode 필드를 삭제하세요.
	demoMode: true,
	// ──────────────────────────────────────────────────────────────────────────────
	projectRoot: "Pharos",
	llmApikey: "",
	llmModel: "",
	githubToken: "",
	githubRepo: "",
	tavilyApiKey: "",
	commitPattern: "^(feat|fix)\\(TASK-(\\d+)\\):",
	dailyDigestTime: "00:00",
	weeklyReminderDay: 6, // 토요일
	weeklyReminderTime: "09:00",
	hocuspocusServerUrl: SERVER_HTTP_URL,
	projectReport: null,
	planningRoadmapGenerated: false,
	developmentRoadmapGenerated: false,
	developmentRoadmap: null,
	attachedMinutes: {},
	tasks: [],
	taskNextId: 1,
	roadmaps: {},
	members: [],
	invites: [],
	availabilities: [],
	commitBatches: [],
	migrated: false,
	authToken:          "",
	githubLogin:        "",
	workspaceId:        null,
	syncIgnorePatterns: ["**/.obsidian/**"],
};

/**
 * ItemView·Modal이 플러그인 인스턴스에 접근할 때 쓰는 최소 타입.
 * main.ts의 PharosPlugin과 순환 참조 방지용.
 *
 * Service·Repository 는 unknown 으로 노출 — 실제 타입은 main.ts에서 주입.
 * 사용처에서 타입 단언으로 캐스팅 (예: `plugin.projectService as ProjectService`).
 * 점진적으로 모든 feature에 Service 추가될 때 같이 업데이트.
 */
export interface PharosPluginLike extends Plugin {
	settings: PharosSettings;
	saveSettings(): Promise<void>;
	/** ProjectService — features/project/services/projectService.ts */
	projectService: import("../features/project/services/projectService").ProjectService;
	/** MeetingsService — features/meeting/services/meetingsService.ts */
	meetingsService: import("../features/meeting/services/meetingsService").MeetingsService;
	/** TaskService — features/task/services/taskService.ts */
	taskService: import("../features/task/services/taskService").TaskService;
	/** RoadmapService — features/roadmap/services/roadmapService.ts */
	roadmapService: import("../features/roadmap/services/roadmapService").RoadmapService;
	/** TeamService — features/team/services/teamService.ts */
	teamService: import("../features/team/services/teamService").TeamService;
	/** AvailabilityService — features/availability/services/availabilityService.ts */
	availabilityService: import("../features/availability/services/availabilityService").AvailabilityService;
	/** CommitService — features/commit/services/commitService.ts */
	commitService: import("../features/commit/services/commitService").CommitService;
	/** ProgressService — features/progress/services/progressService.ts */
	progressService: import("../features/progress/services/progressService").ProgressService;
	/**
	 * InviteService — features/team/services/inviteService.ts
	 * 시연용 LocalInviteService 또는 백엔드용 ServerInviteService 주입 (main.ts).
	 */
	inviteService: import("../features/team/services/inviteService").InviteService;
	/** AgentService — features/agent/services/agentService.ts */
	agentService: import("../features/agent/services/agentService").AgentService;

	// ─── 동기화 인프라 (차후 테스트 후 구현, main.ts에서 주입) ───
	/**
	 * ConnectionManager — shared/infra/sync/ConnectionManager.ts
	 * 파일별 HocuspocusProvider 풀 관리. setToken()으로 재연결.
	 */
	connectionManager: import("../shared/infra/sync/ConnectionManager").ConnectionManager;
	/**
	 * SyncChannelManager — shared/infra/sync/SyncChannelManager.ts
	 * __trigger__ 채널 전용 provider. 에이전트 트리거 신호 수신.
	 */
	syncChannelManager: import("../shared/infra/sync/SyncChannelManager").SyncChannelManager;
}

export class PharosSettingsTab extends PluginSettingTab {
	private readonly plugin: PharosPluginLike;

	constructor(app: App, plugin: PharosPluginLike) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Pharos 설정" });

		// ─── Vault 구조 ───
		containerEl.createEl("h3", { text: "Vault 경로" });

		new Setting(containerEl)
			.setName("프로젝트 루트")
			.setDesc(
				"Pharos가 만드는 파일들의 Vault 내 최상위 폴더. 변경 시 기존 파일은 그대로 둠.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Pharos")
					.setValue(this.plugin.settings.projectRoot)
					.onChange(async (value) => {
						this.plugin.settings.projectRoot = value || "Pharos";
						await this.plugin.saveSettings();
					}),
			);

		// ─── AI ───
		containerEl.createEl("h3", { text: "AI" });

		new Setting(containerEl)
			.setName("Gemini API 키")
			.setDesc(
				"회의 주제·회의록 분석·자료 요약에 사용. 키는 이 컴퓨터에만 저장됨 (외부 전송 X).",
			)
			.addText((text) =>
				text
					.setPlaceholder("...")
					.setValue(this.plugin.settings.llmApikey)
					.onChange(async (value) => {
						this.plugin.settings.llmApikey = value;
						await this.plugin.saveSettings();
					}),
			);

		/** @test @description 임시 필드라 나중에 통째로 제거 필요. 안정성이고 뭐고 신경 안 씀. */
		new Setting(containerEl)
			.setName("모델")
			.setDesc(
				"API 사용량 제한에 빠르게 걸려서 그냥 교체해가면서 하기 위한...",
			)
			.addText((text) =>
				text
					.setPlaceholder("gemini-(version)-(pro/flash/기타 등등)")
					.setValue(this.plugin.settings.llmModel)
					.onChange(async (value) => {
						this.plugin.settings.llmModel = value;

						// 새 모델에 맞게 agentService 통째로 교체
						const { agentService, teamService, availabilityService, meetingsService, progressService, taskService, roadmapService } = this.plugin
						const new_llmProvider = new GeminiProvider(
							() => this.plugin.settings.llmApikey, value
						)
						const searchProvider = new TavilySearchProvider(() => this.plugin.settings.tavilyApiKey);
						this.plugin.agentService = new AgentService(
							teamService,
							availabilityService,meetingsService,
							progressService,
							taskService,
							roadmapService,
							new_llmProvider,
							searchProvider,
						);


						await this.plugin.saveSettings();
					}),
			);

		// ─── GitHub ───
		containerEl.createEl("h3", { text: "GitHub 연동" });

		new Setting(containerEl)
			.setName("GitHub Personal Access Token")
			.setDesc("커밋 조회용. repo 권한 필요. 미입력 시 커밋 검증 비활성.")
			.addText((text) =>
				text
					.setPlaceholder("ghp_...")
					.setValue(this.plugin.settings.githubToken)
					.onChange(async (value) => {
						this.plugin.settings.githubToken = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("GitHub 레포")
			.setDesc("owner/repo 형식 (예: gyeonseokoh/Pharos)")
			.addText((text) =>
				text
					.setPlaceholder("owner/repo")
					.setValue(this.plugin.settings.githubRepo)
					.onChange(async (value) => {
						this.plugin.settings.githubRepo = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("커밋 컨벤션 정규식")
			.setDesc(
				"Task 자동 연결용. 기본: feat|fix(TASK-XXX): pattern. 그룹 2가 Task 번호.",
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.commitPattern)
					.onChange(async (value) => {
						this.plugin.settings.commitPattern = value;
						await this.plugin.saveSettings();
					}),
			);

		// ─── Tavily ───
		containerEl.createEl("h3", { text: "웹 검색 (Tavily)" });

		new Setting(containerEl)
			.setName("Tavily API 키")
			.setDesc("회의 자료 수집(PO-3) 용. 미입력 시 자료 수집 비활성.")
			.addText((text) =>
				text
					.setPlaceholder("tvly-...")
					.setValue(this.plugin.settings.tavilyApiKey)
					.onChange(async (value) => {
						this.plugin.settings.tavilyApiKey = value;
						await this.plugin.saveSettings();
					}),
			);

		// ─── 스케줄러 ───
		containerEl.createEl("h3", { text: "자동 실행 일정" });

		new Setting(containerEl)
			.setName("진행도 페이지 갱신 시각")
			.setDesc("매일 이 시각에 GitHub 커밋 + 체크리스트를 집계 (KST)")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.dailyDigestTime)
					.onChange(async (value) => {
						this.plugin.settings.dailyDigestTime = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("주간 가용시간 알림 요일")
			.addDropdown((d) =>
				d
					.addOptions({
						"0": "일",
						"1": "월",
						"2": "화",
						"3": "수",
						"4": "목",
						"5": "금",
						"6": "토",
					})
					.setValue(String(this.plugin.settings.weeklyReminderDay))
					.onChange(async (value) => {
						this.plugin.settings.weeklyReminderDay = Number(value);
						await this.plugin.saveSettings();
					}),
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.weeklyReminderTime)
					.onChange(async (value) => {
						this.plugin.settings.weeklyReminderTime = value;
						await this.plugin.saveSettings();
					}),
			);

		// ─── 서버 동기화 ───
		containerEl.createEl("h3", { text: "서버 동기화" });

		new Setting(containerEl)
			.setName("동기화 제외 패턴")
			.setDesc(
				"한 줄에 패턴 하나. .gitignore 방식 지원.\n" +
				"예: **/.obsidian/**  ·  *.tmp  ·  Pharos/archive/**\n" +
				"비워두면 .md 파일 전체를 동기화합니다.",
			)
			.addTextArea((area) => {
				area
					.setPlaceholder("**/.obsidian/**\n*.tmp")
					.setValue(this.plugin.settings.syncIgnorePatterns.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.syncIgnorePatterns = value
							.split("\n")
							.map((p) => p.trim())
							.filter((p) => p.length > 0);
						await this.plugin.saveSettings();
					});
				// 여러 줄이 보이도록 textarea 높이 확장
				area.inputEl.style.width  = "100%";
				area.inputEl.style.height = "120px";
				area.inputEl.style.fontFamily = "monospace";
				area.inputEl.style.fontSize   = "12px";
				return area;
			});


		// ─── GitHub 계정 ───
		containerEl.createEl("h3", { text: "GitHub 계정" });

		if (this.plugin.settings.authToken) {
			// 인증된 상태: 로그인명 + 로그아웃 버튼
			new Setting(containerEl)
				.setName("연결된 계정")
				.setDesc(`@${this.plugin.settings.githubLogin} 으로 로그인됨`)
				.addButton((btn) =>
					btn
						.setButtonText("로그아웃")
						.setWarning()
						.onClick(async () => {
							this.plugin.settings.authToken   = "";
							this.plugin.settings.githubLogin = "";
							await this.plugin.saveSettings();
							this.display(); // 섹션 재렌더
						}),
				);
		} else {
			// 미인증 상태: 로그인 버튼
			new Setting(containerEl)
				.setName("GitHub으로 로그인")
				.setDesc("서버 JWT를 발급받아 실시간 동기화와 에이전트 트리거를 활성화합니다.")
				.addButton((btn) =>
					btn
						.setButtonText("로그인")
						.setCta()
						.onClick(() => {
							// electron.shell은 Obsidian 데스크탑 내장 Node 환경 전용
							// ← TODO: 모바일 대응 필요 시 window.open() 분기 추가
							try {
								const { shell } = (window as any).require("electron");
								shell.openExternal(`${SERVER_HTTP_URL}/auth/github`);
							} catch {
								// electron 없는 환경(모바일) — fallback
								window.open(`${SERVER_HTTP_URL}/auth/github`, "_blank");
							}
						}),
				);
		}
	}
}
