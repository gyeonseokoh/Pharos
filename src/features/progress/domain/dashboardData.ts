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
 * DashboardView가 받는 데이터 전체 묶음.
 */
export interface DashboardData {
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
}
