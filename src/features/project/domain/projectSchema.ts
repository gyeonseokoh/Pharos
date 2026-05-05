/**
 * Project 엔티티 스키마.
 *
 * Repository·Service·UI 모두 이 타입을 참조.
 * Zod로 런타임 검증 가능 (잘못된 .md frontmatter 파싱 방지).
 */

import { z } from "zod";

/** 고정 회의 시간 모드. */
export const FixedMeetingMode = z.enum(["auto", "manual"]);
export type FixedMeetingMode = z.infer<typeof FixedMeetingMode>;

/**
 * Project v1 스키마.
 *
 * 단일 인스턴스 엔티티 (한 Vault에 1개). `project.md` 파일에 저장.
 */
export const ProjectV1 = z.object({
	version: z.literal(1),
	type: z.literal("project"),
	id: z.string(),
	name: z.string().min(1),
	description: z.string().default(""),
	deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	fixedMeetingMode: FixedMeetingMode,
	fixedMeetingDay: z.number().int().min(0).max(6).optional(),
	fixedMeetingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
	planningRoadmapGenerated: z.boolean().default(false),
	developmentRoadmapGenerated: z.boolean().default(false),
	/**
	 * Hocuspocus 동기화용 workspace 식별자.
	 * 프로젝트 생성 시 UUID 자동 발급, 초대 링크에 포함.
	 * 빈 문자열 = 로컬 전용 (동기화 X).
	 */
	workspaceId: z.string().default(""),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Project = z.infer<typeof ProjectV1>;

/**
 * 사용자 입력(NewProjectModal 폼) → Project 엔티티 변환용 입력 타입.
 * version·type·id·createdAt·updatedAt·workspaceId·플래그는 Service가 채움.
 */
export interface ProjectInput {
	name: string;
	description: string;
	deadline: string;
	fixedMeetingMode: FixedMeetingMode;
	fixedMeetingDay?: number;
	fixedMeetingTime?: string;
}
