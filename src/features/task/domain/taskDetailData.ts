/**
 * Task 상세 페이지 데이터 타입 (PO-11 세분화 + PM-3 체크 + PM-4 커밋 검증).
 */

export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";
export type TaskPhase = "PLANNING" | "DEVELOPMENT";
export type CommitVerifyResult = "verified" | "unverified" | "manual";

export interface TaskChecklistItem {
	id: string;
	text: string;
	checked: boolean;
	checkedAt: string | null;
	checkedBy: string | null;
}

export interface TaskLinkedCommit {
	sha: string;
	message: string;
	author: string;
	/** ISO datetime. */
	date: string;
	verifyResult: CommitVerifyResult;
	filesChanged?: number;
	linesAdded?: number;
	linesRemoved?: number;
}

export interface TaskAssignee {
	id: string;
	name: string;
	role: "PO" | "PM";
}

/**
 * 이 Task가 추출된 출처 회의 링크.
 * 회의록(PO-5) ↔ Task(PO-6) 역추적용 — PO-6 자동 생성 시 기록됨.
 */
export interface TaskSourceMeeting {
	meetingId: string;
	title: string;
	date: string; // ISO date
}

export interface TaskDetailData {
	/** TASK-XXX. */
	id: string;
	title: string;
	description: string;
	startDate: string;
	endDate: string;
	status: TaskStatus;
	priority: TaskPriority;
	phase: TaskPhase;
	assignee: TaskAssignee | null;
	dependsOn: Array<{ id: string; title: string }>;
	checklist: TaskChecklistItem[];
	/** PM-4 커밋 검증 결과로 찾은 연결 커밋들. */
	linkedCommits: TaskLinkedCommit[];
	/** PO-6 생성 시 기록된 출처 회의록들. */
	sourceMeetings?: TaskSourceMeeting[];
}
