/**
 * ProgressService — 진행도 집계 Facade.
 *
 * Task·Checklist 데이터를 집계해서 Dashboard·ProgressPage에 필요한 요약 제공.
 * CRUD Repository가 아닌 read-only 집계 서비스.
 *
 * v2에서 CommitRepository 연동 시 commit 집계도 추가 예정.
 */

import type { TaskRepository } from "../../task/repositories/taskRepository";

export interface TaskProgressSummary {
	total: number;
	todo: number;
	inProgress: number;
	done: number;
	blocked: number;
	/** 완료율 0~100. */
	completionRate: number;
}

export interface MemberProgressSummary {
	memberId: string;
	total: number;
	done: number;
	inProgress: number;
}

export class ProgressService {
	constructor(private readonly taskRepo: TaskRepository) {}

	/**
	 * 전체 Task 진행도 요약. (Dashboard·ProgressPage용)
	 */
	async getTaskSummary(): Promise<TaskProgressSummary> {
		const tasks = await this.taskRepo.list();
		const total = tasks.length;
		const todo = tasks.filter((t) => t.status === "todo").length;
		const inProgress = tasks.filter((t) => t.status === "in-progress").length;
		const done = tasks.filter((t) => t.status === "done").length;
		const blocked = tasks.filter((t) => t.status === "blocked").length;
		const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);

		return { total, todo, inProgress, done, blocked, completionRate };
	}

	/**
	 * 팀원별 Task 진행도 요약. (ProgressPage 팀원 카드용)
	 */
	async getMemberSummaries(): Promise<MemberProgressSummary[]> {
		const tasks = await this.taskRepo.list();
		const map = new Map<string, MemberProgressSummary>();

		for (const task of tasks) {
			if (!task.assignee) continue;
			const id = task.assignee.id;
			const existing = map.get(id) ?? {
				memberId: id,
				total: 0,
				done: 0,
				inProgress: 0,
			};
			existing.total++;
			if (task.status === "done") existing.done++;
			if (task.status === "in-progress") existing.inProgress++;
			map.set(id, existing);
		}

		return Array.from(map.values());
	}

	/**
	 * 개발 단계 Task만 요약. (개발 로드맵 진행도용)
	 */
	async getDevelopmentSummary(): Promise<TaskProgressSummary> {
		const all = await this.taskRepo.list();
		const tasks = all.filter((t) => t.phase === "DEVELOPMENT");
		const total = tasks.length;
		const todo = tasks.filter((t) => t.status === "todo").length;
		const inProgress = tasks.filter((t) => t.status === "in-progress").length;
		const done = tasks.filter((t) => t.status === "done").length;
		const blocked = tasks.filter((t) => t.status === "blocked").length;
		const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);

		return { total, todo, inProgress, done, blocked, completionRate };
	}
}
