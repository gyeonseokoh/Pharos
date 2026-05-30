/**
 * Task 엔티티 스키마.
 *
 * docs/architecture/repository-design.md 4.4절 기준.
 * Repository·Service·UI 모두 이 타입을 참조.
 * taskDetailData.ts 는 화면 렌더링용 뷰모델 — 저장 단위는 이 스키마 기준.
 *
 * - assignee: 담당자 임베디드 객체 (id·name·role). null = 미배정.
 * - checklist: Task에 내장된 체크리스트 배열 (별도 Repository 없음).
 */

import { z } from "zod";

export const TaskStatusSchema = z.enum(["todo", "in-progress", "done", "blocked"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskPhaseSchema = z.enum(["PLANNING", "DEVELOPMENT"]);
export type TaskPhase = z.infer<typeof TaskPhaseSchema>;

/** Task에 연결된 커밋 요약. PM-4 검증 결과. */
export const LinkedCommitSchema = z.object({
	sha: z.string().min(1),
	message: z.string(),
	author: z.string(),
	date: z.string(),
	verifyResult: z.enum(["verified", "unverified"]),
});
export type LinkedCommit = z.infer<typeof LinkedCommitSchema>;

/** Task 내장 담당자 정보. */
export const AssigneeSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	role: z.string().min(1),
});
export type Assignee = z.infer<typeof AssigneeSchema>;

/** Task 내장 체크리스트 항목. 별도 Repository 없이 Task 안에 배열로 저장. */
export const ChecklistItemSchema = z.object({
	id: z.string().min(1),
	text: z.string().min(1),
	checked: z.boolean(),
	checkedAt: z.string().nullable(),
	checkedBy: z.string().nullable(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

/**
 * Task v1 스키마.
 *
 * - id: `TASK-<number>` 형식.
 * - phase: 기획(PLANNING) / 개발(DEVELOPMENT) 로드맵 소속 구분.
 * - phaseId: 로드맵 내 특정 단계 ID (예: "dev-mvp").
 * - roadmapId: 소속 로드맵 ID (예: "roadmap-development").
 * - assignee: 담당자 임베디드 객체. null = 미배정.
 * - userChecked: 담당자 본인 완료 체크 (GitHub 커밋과 별도).
 * - checklist: Task 내장 체크리스트 (별도 Repository 없음).
 */
export const TaskV1 = z.object({
	version: z.literal(1),
	type: z.literal("task"),
	id: z.string().regex(/^TASK-\d+$/, "TASK-<number> 형식이어야 합니다"),
	roadmapId: z.string().optional(),
	phaseId: z.string().optional(),
	title: z.string().min(1),
	description: z.string().default(""),
	status: TaskStatusSchema,
	userChecked: z.boolean().default(false),
	priority: TaskPrioritySchema,
	phase: TaskPhaseSchema,
	/** 담당자 임베디드. null = 미배정. */
	assignee: AssigneeSchema.nullable(),
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	dependsOn: z.array(z.string().regex(/^TASK-\d+$/)).default([]),
	sourceMeetings: z.array(z.string()).default([]),
	/** PM-4 커밋 검증 결과 목록. appendCommit()으로 추가. */
	linkedCommits: z.array(LinkedCommitSchema).default([]),
	/** Task 내장 체크리스트. */
	checklist: z.array(ChecklistItemSchema).default([]),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Task = z.infer<typeof TaskV1>;

/**
 * UI 폼 → Task 엔티티 변환용 입력 타입.
 * version·type·id·createdAt·updatedAt은 Service가 채움.
 */
export interface TaskInput {
	title: string;
	description?: string;
	/** null = 미배정. */
	assignee: Assignee | null;
	startDate: string;
	endDate: string;
	priority: TaskPriority;
	phase: TaskPhase;
	phaseId?: string;
	roadmapId?: string;
	dependsOn?: string[];
}
