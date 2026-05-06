/**
 * Availability 엔티티 스키마.
 *
 * docs/architecture/repository-design.md 4.6절 기준.
 * 주차별(ISO week) 팀원 가용시간 슬롯.
 *
 * - id: "avail-2026-W17" 형식 (주차 기준 유니크).
 * - weekStart: 해당 주 월요일 ISO date.
 * - slots: 팀원별·요일별 가용 시간 블록 목록.
 */

import { z } from "zod";

export const AvailabilitySlotV1 = z.object({
	memberId: z.string().min(1),
	/** 0=일 ~ 6=토 */
	day: z.number().int().min(0).max(6),
	/** "HH:MM" */
	start: z.string().regex(/^\d{2}:\d{2}$/),
	/** "HH:MM" */
	end: z.string().regex(/^\d{2}:\d{2}$/),
});

export type AvailabilitySlot = z.infer<typeof AvailabilitySlotV1>;

export const AvailabilityV1 = z.object({
	version: z.literal(1),
	type: z.literal("availability"),
	/** "avail-2026-W17" */
	id: z.string().min(1),
	/** 해당 주 월요일 ISO date (YYYY-MM-DD) */
	weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	slots: z.array(AvailabilitySlotV1).default([]),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Availability = z.infer<typeof AvailabilityV1>;
