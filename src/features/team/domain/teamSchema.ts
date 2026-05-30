/**
 * Member / Invite 엔티티 스키마.
 *
 * docs/architecture/repository-design.md 4.5절 기준.
 * Repository·Service·UI 모두 이 타입을 참조.
 * teamListData.ts 는 화면 렌더링용 뷰모델 — 저장 단위는 이 스키마 기준.
 */

import { z } from "zod";

export const MemberRoleSchema = z.enum(["PO", "PM"]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const MemberPermissionSchema = z.enum(["ADMIN", "WRITE", "READ"]);
export type MemberPermission = z.infer<typeof MemberPermissionSchema>;

export const MemberStatusSchema = z.enum(["active", "left", "invited"]);
export type MemberStatus = z.infer<typeof MemberStatusSchema>;

/**
 * Member v1 스키마.
 *
 * - status: "active" 활동 중 / "left" 이탈 / "invited" 초대 수락 대기.
 * - 이탈(left) 후에도 레코드 유지 — 할당된 Task의 assigneeId 참조 보존.
 */
export const MemberV1 = z.object({
	version: z.literal(1),
	type: z.literal("team-member"),
	id: z.string().min(1),
	name: z.string().min(1),
	/** 옵셔널. GitHub OAuth 연동 시 자동 채워짐 (경석 sync 모듈). */
	email: z.string().email().optional(),
	role: MemberRoleSchema,
	permission: MemberPermissionSchema,
	techStacks: z.array(z.string()).default([]),
	status: MemberStatusSchema,
	joinedAt: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Member = z.infer<typeof MemberV1>;

/**
 * Invite v1 스키마.
 *
 * - 발송 후 수락 전 상태의 초대 링크 메타.
 * - expiresAt: 24시간 후 자동 만료.
 * - email: null 이면 링크만 발급 (이메일 없이).
 */
export const InviteV1 = z.object({
	version: z.literal(1),
	type: z.literal("invite"),
	id: z.string().min(1),
	email: z.string().email().nullable(),
	permission: MemberPermissionSchema,
	invitedAt: z.string(),
	expiresAt: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Invite = z.infer<typeof InviteV1>;

/**
 * UI 폼 → Member 엔티티 변환용 입력 타입.
 * version·type·id·status·joinedAt·createdAt·updatedAt은 Service가 채움.
 * email은 옵셔널 — GitHub OAuth 연동 시 별도 채워짐.
 */
export interface MemberInput {
	name: string;
	email?: string;
	role: MemberRole;
	permission: MemberPermission;
	techStacks: string[];
}

/**
 * 초대 발송 입력 타입.
 */
export interface InviteInput {
	email: string | null;
	permission: MemberPermission;
}
