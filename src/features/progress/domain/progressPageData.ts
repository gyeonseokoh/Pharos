/**
 * 공개 진행도 페이지(PO-12 팀 전체) 데이터 타입.
 *
 * "누가 오늘 무엇을 했는지" 팀 전체에 공유하는 페이지.
 * 매일 자정 자동 갱신 + 회의 직전 자동 + 수동 갱신.
 */

export type MemberRole = "PO" | "PM";

/** 체크리스트 항목 체크 이벤트. */
export interface CheckActivity {
	type: "check";
	/** ISO datetime. */
	timestamp: string;
	/** TASK-XXX. */
	taskId: string;
	/** Task 제목 (예: "로그인 API 구현"). */
	taskTitle: string;
	/** 체크된 세분화 항목 텍스트 (예: "엔드포인트 정의"). */
	itemText: string;
}

/** GitHub 커밋 이벤트. */
export interface CommitActivity {
	type: "commit";
	timestamp: string;
	/** 7~40자 SHA. */
	sha: string;
	/** 커밋 메시지 첫 줄. */
	message: string;
	/** `feat(TASK-XXX):` / `fix(TASK-XXX):` 에서 추출된 Task ID. 매칭 실패 시 `null`. */
	taskId: string | null;
	filesChanged?: number;
	linesAdded?: number;
	linesRemoved?: number;
}

export type ActivityItem = CheckActivity | CommitActivity;

export interface MemberProgressStats {
	checksToday: number;
	commitsToday: number;
	checksThisWeek: number;
	commitsThisWeek: number;
}

export interface MemberProgressDetail {
	id: string;
	name: string;
	role: MemberRole;
	stats: MemberProgressStats;
	/** 최근 활동 목록 (시간 역순). */
	recentActivity: ActivityItem[];
	/** AI 자동 요약 (일별 narrative). 아직 생성 전이면 `null`. */
	narrative: string | null;
}

export interface TeamProgressSummary {
	totalChecks: number;
	totalCommits: number;
	/** 해당 기간에 활동이 1건 이상 있는 멤버 수. */
	activeMembers: number;
	totalMembers: number;
}

export interface ProgressPeriod {
	/** ISO date. */
	start: string;
	end: string;
	/** 화면에 표시할 라벨 ("오늘", "2026-04-24", "이번 주" 등). */
	label: string;
}

/**
 * ProgressPageView가 받는 데이터 전체 묶음.
 */
export interface ProgressPageData {
	projectName: string;
	/** 마지막 자동/수동 갱신 ISO datetime. */
	lastUpdated: string;
	period: ProgressPeriod;
	team: TeamProgressSummary;
	members: MemberProgressDetail[];
}
