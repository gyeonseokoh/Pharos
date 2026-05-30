/**
 * 내 업무 뷰 (PO-12 개인 타임라인 + PM-3 체크리스트) 데이터 타입.
 *
 * 본인에게 할당된 Task 리스트와 각 Task의 세분화 체크리스트를 그림.
 * 체크박스 클릭 시 PM-3 로직(실제로는 `checklistService.toggle(...)`)이 호출된다.
 */

export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";
export type TaskPhase = "PLANNING" | "DEVELOPMENT";
export type MemberRole = "PO" | "PM";

export interface MyChecklistItem {
	id: string;
	text: string;
	checked: boolean;
	/** 체크된 시각 ISO datetime. 미체크면 `null`. */
	checkedAt: string | null;
}

export interface MyTask {
	/** TASK-XXX. */
	id: string;
	title: string;
	description?: string;
	/** ISO date `YYYY-MM-DD`. */
	startDate: string;
	endDate: string;
	status: TaskStatus;
	priority: TaskPriority;
	phase: TaskPhase;
	checklist: MyChecklistItem[];
}

export interface MyProfile {
	id: string;
	name: string;
	role: MemberRole;
}

export interface MyTasksStats {
	/** 내 전체 Task 수. */
	totalTasks: number;
	inProgressTasks: number;
	todoTasks: number;
	doneTasks: number;
	/** 전체 체크리스트 항목 수 (모든 Task 합산). */
	totalChecklistItems: number;
	completedChecklistItems: number;
	/** 오늘 마감인 Task 수. */
	dueTodayTasks: number;
}

export interface MyTasksData {
	profile: MyProfile;
	stats: MyTasksStats;
	tasks: MyTask[];
}
