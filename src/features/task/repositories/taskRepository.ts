/**
 * TaskRepository — Task 엔티티 데이터 접근 인터페이스.
 *
 * docs/architecture/repository-design.md 5.2절 기준.
 * 체크리스트는 Task에 내장(embedded)되므로 별도 ChecklistRepository 없음.
 *
 * 구현체:
 *   - SettingsTaskRepository     (1단계, data.json 기반, 현재 사용)
 *   - VaultTaskRepository        (2단계, Pharos/Tasks/*.md 기반)
 *   - HocuspocusTaskRepository   (3단계, 백엔드 실시간 동기화) ← 백엔드 연결 지점
 */

import type { ChangeEvent, Disposable } from "../../../shared/repo/types";
import type { LinkedCommit, Task, TaskStatus } from "../domain/taskSchema";

export type { LinkedCommit };

export interface TaskRepository {
	/** 전체 Task 목록. */
	list(): Promise<Task[]>;
	/** ID로 단일 Task 조회. */
	getById(id: string): Promise<Task | null>;
	/** Task 저장 (신규·갱신). updatedAt 자동 갱신. */
	save(task: Task): Promise<void>;
	/** Task 삭제. */
	delete(id: string): Promise<void>;
	/** 특정 phaseId 에 속한 Task 목록 (예: "dev-mvp"). 로드맵 단계별 표시용. */
	listByPhase(phaseId: string): Promise<Task[]>;
	/** 담당자별 Task 목록. 팀원 상세 뷰용. */
	listByAssignee(memberId: string): Promise<Task[]>;
	/** 상태별 Task 목록. */
	listByStatus(status: TaskStatus): Promise<Task[]>;
	/** 담당자 본인 완료 체크 토글 (PM-3). */
	setUserCheck(taskId: string, checked: boolean): Promise<void>;
	/** 커밋 검증 결과를 Task에 연결 (PM-4). */
	appendCommit(taskId: string, commit: LinkedCommit): Promise<void>;
	/** 다음 TASK-<number> ID 생성. */
	nextId(): Promise<string>;
	/** 변경 구독. dispose()로 해제. */
	watch(callback: (event: ChangeEvent<Task>) => void): Disposable;
}
