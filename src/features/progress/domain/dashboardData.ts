/**
 * Dashboard에 필요한 데이터 타입 (view-model).
 *
 * 이 인터페이스들은 `DashboardView`가 받는 props 형태를 정의한다.
 * - 오늘: `ui/mock.ts`가 이 형태로 목업 데이터 제공
 * - 미래: `progressService` 등이 같은 형태로 실제 데이터 제공
 *
 * 순수 타입만 있으며 UI/React/Obsidian 의존 없음.
 */

export interface ProjectSummary {
	name: string;
	/** ISO date `YYYY-MM-DD`. */
	deadline: string;
	/** 프로토타입 마감까지 남은 일수. 프로토타입 없으면 `null`. */
	daysUntilPrototype: number | null;
	/** 프로젝트 총 기간(일). */
	totalDays: number;
}

export interface ProgressSummary {
	totalTasks: number;
	completedTasks: number;
	/** 이번 주 팀 전체 커밋 수. */
	thisWeekCommits: number;
}

export interface PhaseProgress {
	/** 0~100. */
	percent: number;
	/** 이 단계 마감까지 남은 일수. */
	dday: number;
}

export interface MyTasksSummary {
	inProgress: number;
	total: number;
	/** 화면에 표시할 현재 사용자 이름 (예: "유석"). */
	memberName: string;
}

export interface MemberActivity {
	id: string;
	name: string;
	role: "PO" | "PM";
	checks: number;
	commits: number;
}

export interface UpcomingMeeting {
	/**
	 * 회의 고유 ID.
	 * 대시보드 카드에서 해당 회의 페이지로 직접 이동할 때 사용.
	 * optional로 선언한 이유: 실서비스 연동 시 meetingsService.list()가 반환하는
	 * Meeting 객체에 id가 이미 있으므로 buildDashboardData에서 그대로 전달하면 되고,
	 * 없을 경우에는 회의 목록 전체로 fallback해 기존 동작이 유지된다.
	 * 새로운 API·서비스 메서드를 추가한 게 아니라 기존 필드를 활용한 것이라
	 * 시나리오 흐름에 영향을 주지 않는다.
	 */
	id?: string;
	date: string; // ISO date
	time: string; // HH:MM
	title: string;
}

export interface ImportantDate {
	label: string;
	date: string;
	dday: number;
}

export type AlertSeverity = "danger" | "warning" | "info";

export interface DashboardAlert {
	severity: AlertSeverity;
	text: string;
}

/**
 * AI 진행 분석 카드 view-model (PO-12).
 *
 * AgentService.analyzeProgress 결과의 UI 표시용 부분만 추림.
 * loading=true 시 카드는 스피너 표시.
 * result=null + loading=false 시 "AI 분석 받기" 버튼.
 * result 있으면 overallHealth / summary / insights 카드 렌더.
 */
export interface ProgressAnalysisCard {
	loading: boolean;
	error: string | null;
	result: ProgressAnalysisCardResult | null;
}

export interface ProgressAnalysisCardResult {
	asOf: string;
	overallHealth: "on-track" | "at-risk" | "critical";
	summary: string;
	insights: Array<{
		type: "milestone" | "risk" | "achievement" | "recommendation";
		message: string;
	}>;
}

/**
 * 최근 회의록 카드 view-model (PO-5 진입점).
 *
 * Dashboard 의 회의록 카드 → "회의록 관리" 진입 + 최근 3건 빠른 미리보기.
 */
export interface RecentMinutesEntry {
	meetingId: string;
	meetingTitle: string;
	meetingDate: string; // ISO date
	authorName: string;
	writtenAt: string; // ISO datetime
	preview: string; // 첫 ~120자
}

/**
 * DashboardView가 받는 데이터 전체 묶음.
 */
export interface DashboardData {
	/**
	 * 프로젝트 진행 단계.
	 * setup       : 기획 로드맵 미생성
	 * planning    : 기획 로드맵 생성됨, 개발 로드맵 미생성
	 * development : 개발 로드맵 생성됨 (전체 UI)
	 */
	phase: "setup" | "planning" | "development";
	project: ProjectSummary;
	progress: ProgressSummary;
	/** 프로토타입이 없는 프로젝트면 `null`. */
	prototypeProgress: PhaseProgress | null;
	developmentProgress: PhaseProgress;
	myTasks: MyTasksSummary;
	members: MemberActivity[];
	meetings: UpcomingMeeting[];
	importantDates: ImportantDate[];
	alerts: DashboardAlert[];
	/** PO-12 AI 진행 분석. null 이면 카드 영역 자체 생략. */
	progressAnalysis?: ProgressAnalysisCard | null;
	/** 회의록 관리 카드용 최근 회의록 N건. 비어있으면 카드 표시 안 함. */
	recentMinutes?: RecentMinutesEntry[];
}
