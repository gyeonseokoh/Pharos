/**
 * Roadmap 엔티티 스키마.
 *
 * docs/architecture/repository-design.md 4.3절 기준.
 * Roadmap은 단일 인스턴스 엔티티 — kind 당 1개 (planning / development).
 * 개별 Task는 taskSchema.ts 의 Task 엔티티로 저장되고,
 * Task.phase 필드로 어느 로드맵 소속인지 구분한다.
 * 이 스키마는 로드맵 전체의 Phase 구성(색상·기간·상태)을 저장한다.
 *
 * roadmapData.ts 는 화면 렌더링용 뷰모델 — 저장 단위는 이 스키마 기준.
 */

import { z } from "zod";

export const RoadmapKindSchema = z.enum(["planning", "development"]);
export type RoadmapKind = z.infer<typeof RoadmapKindSchema>;

export const PhaseStatusSchema = z.enum(["todo", "in-progress", "completed"]);
export type PhaseStatus = z.infer<typeof PhaseStatusSchema>;

/**
 * 로드맵 내 단계(Phase) 스키마.
 * RoadmapV1에 인라인 배열로 저장된다.
 */
export const RoadmapPhaseV1 = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	status: PhaseStatusSchema,
	activities: z.array(z.string()).default([]),
	/** 화살표 블록 색상 HEX (예: "#3b82f6"). */
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type RoadmapPhase = z.infer<typeof RoadmapPhaseV1>;

/**
 * Roadmap v1 스키마.
 *
 * - roadmapKind: "planning" (PO-1 생성) / "development" (PO-6 생성).
 * - phases: 로드맵을 구성하는 단계 목록.
 * - 각 Task의 소속은 Task.phase + Task.phaseId 로 관리 (별도 저장).
 */
export const RoadmapV1 = z.object({
	version: z.literal(1),
	type: z.literal("roadmap"),
	id: z.string().min(1),
	roadmapKind: RoadmapKindSchema,
	phases: z.array(RoadmapPhaseV1).min(1),
	generatedAt: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Roadmap = z.infer<typeof RoadmapV1>;

/**
 * AI 응답 → Roadmap 엔티티 변환용 입력 타입.
 * version·type·id·createdAt·updatedAt은 Service가 채움.
 */
export interface RoadmapInput {
	roadmapKind: RoadmapKind;
	phases: Array<{
		id: string;
		name: string;
		start: string;
		end: string;
		status: PhaseStatus;
		activities?: string[];
		color: string;
	}>;
}
