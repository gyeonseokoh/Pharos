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
}
