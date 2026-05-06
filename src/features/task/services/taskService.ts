/**
 * TaskService — Task·Checklist 관련 비즈니스 로직 Facade.
 *
 * UI·백엔드·AI 에이전트가 모두 이 Service를 통해 Task 조작.
 * 내부에서 Repository 호출 + 도메인 이벤트 발행.
 *
 * 사용:
 *   await taskService.create({ title, assigneeId, ... });
 *   await taskService.setUserCheck("TASK-001", true);
 *   await taskService.addChecklistItem("TASK-001", "레이아웃 목업");
 */

import { eventBus } from "../../../shared/repo/eventBus";
import type { ChecklistItem, Task, TaskInput, TaskStatus } from "../domain/taskSchema";
import type { ChecklistRepository, LinkedCommit, TaskRepository } from "../repositories/taskRepository";

export class TaskService {
	constructor(
		private readonly repo: TaskRepository,
		private readonly checklistRepo: ChecklistRepository,
	) {}

	/** 전체 Task 목록. */
	async list(): Promise<Task[]> {
		return this.repo.list();
	}

	/** ID로 단일 Task 조회. */
	async getById(id: string): Promise<Task | null> {
		return this.repo.getById(id);
	}

	/** 특정 phaseId에 속한 Task 목록 (예: "dev-mvp"). */
	async listByPhase(phaseId: string): Promise<Task[]> {
		return this.repo.listByPhase(phaseId);
	}

	/** PLANNING / DEVELOPMENT 구분으로 Task 목록. */
	async listByRoadmapKind(kind: "PLANNING" | "DEVELOPMENT"): Promise<Task[]> {
		const all = await this.repo.list();
		return all.filter((t) => t.phase === kind);
	}

	/** 담당자별 Task 목록. */
	async listByAssignee(memberId: string): Promise<Task[]> {
		return this.repo.listByAssignee(memberId);
	}

	/** 상태별 Task 목록. */
	async listByStatus(status: TaskStatus): Promise<Task[]> {
		return this.repo.listByStatus(status);
	}

	/**
	 * 새 Task 생성. (PO-6 AI 자동 생성 or 수동 추가)
	 *
	 * 책임:
	 *   - TASK-<n> ID 자동 발급
	 *   - 기본 status "todo", userChecked false 설정
	 *   - Repository 저장
	 *   - "task:created" 이벤트 발행
	 */
	async create(input: TaskInput): Promise<Task> {
		const now = new Date().toISOString();
		const id = await this.repo.nextId();
		const task: Task = {
			version: 1,
			type: "task",
			id,
			title: input.title,
			description: input.description ?? "",
			status: "todo",
			userChecked: false,
			priority: input.priority,
			phase: input.phase,
			phaseId: input.phaseId,
			roadmapId: input.roadmapId,
			assigneeId: input.assigneeId,
			startDate: input.startDate,
			endDate: input.endDate,
			dependsOn: input.dependsOn ?? [],
			sourceMeetings: [],
			createdAt: now,
			updatedAt: now,
		};
		await this.repo.save(task);
		eventBus.emit("task:created", { taskId: id });
		return task;
	}

	/**
	 * Task 업데이트. (PO-11 세분화)
	 */
	async update(task: Task): Promise<void> {
		await this.repo.save(task);
		eventBus.emit("task:updated", { taskId: task.id });
	}

	/** Task 삭제. */
	async delete(id: string): Promise<void> {
		await this.repo.delete(id);
	}

	/**
	 * 담당자 본인 완료 체크 토글. (PM-3)
	 *
	 * GitHub 커밋 검증과 별도로 본인이 직접 체크.
	 */
	async setUserCheck(taskId: string, checked: boolean): Promise<void> {
		await this.repo.setUserCheck(taskId, checked);
		eventBus.emit("task:checked", { taskId, checked });
	}

	/**
	 * 커밋 검증 결과 Task에 연결. (PM-4)
	 */
	async appendCommit(taskId: string, commit: LinkedCommit): Promise<void> {
		await this.repo.appendCommit(taskId, commit);
		eventBus.emit("task:updated", { taskId });
	}

	/** Task의 체크리스트 전체 조회. */
	async listChecklist(taskId: string): Promise<ChecklistItem[]> {
		return this.checklistRepo.listByTask(taskId);
	}

	/**
	 * 체크리스트 항목 추가.
	 */
	async addChecklistItem(taskId: string, text: string): Promise<ChecklistItem> {
		const now = new Date().toISOString();
		const item: ChecklistItem = {
			version: 1,
			type: "checklist-item",
			id: `chk-${Date.now()}`,
			taskId,
			text,
			checked: false,
			checkedAt: null,
			checkedBy: null,
			createdAt: now,
			updatedAt: now,
		};
		await this.checklistRepo.save(item);
		return item;
	}

	/**
	 * 체크리스트 항목 체크/해제. (PM-3)
	 */
	async toggleChecklistItem(
		itemId: string,
		taskId: string,
		checked: boolean,
		checkedBy: string,
	): Promise<void> {
		const existing = (await this.checklistRepo.listByTask(taskId)).find(
			(c) => c.id === itemId,
		);
		if (!existing) throw new Error(`체크리스트 항목 ${itemId} 를 찾을 수 없습니다`);

		const now = new Date().toISOString();
		await this.checklistRepo.save({
			...existing,
			checked,
			checkedAt: checked ? now : null,
			checkedBy: checked ? checkedBy : null,
			updatedAt: now,
		});
		eventBus.emit("task:checked", { taskId, checked });
	}

	/** 체크리스트 항목 삭제. */
	async deleteChecklistItem(id: string): Promise<void> {
		await this.checklistRepo.delete(id);
	}
}
