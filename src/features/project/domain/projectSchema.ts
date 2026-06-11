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
    // workspaceId 제거. 사용자가 편집 불가능하도록.
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

/**
 * 프로젝트 진행 단계.
 *
 * - `setup`       기획 로드맵도 아직 없는 초기 단계
 * - `planning`    기획 로드맵 생성됨, 개발 로드맵 미생성 (회의·분석 중심)
 * - `development` 개발 로드맵까지 생성됨 (Task·진척도·커밋 중심)
 *
 * UI 가 단계별로 노출 영역을 달리해 사용자 인지부하를 줄이는 데 사용.
 */
export type ProjectPhase = "setup" | "planning" | "development";

/**
 * 프로젝트 단계 판별. 플래그 기반 결정형 — null/undefined 입력은 "setup" 반환.
 */
export function getProjectPhase(
	project: Pick<
		Project,
		"planningRoadmapGenerated" | "developmentRoadmapGenerated"
	> | null
	| undefined,
): ProjectPhase {
	if (!project) return "setup";
	if (project.developmentRoadmapGenerated) return "development";
	if (project.planningRoadmapGenerated) return "planning";
	return "setup";
}

/** UI 표시용 한국어 라벨. */
export function getProjectPhaseLabel(phase: ProjectPhase): string {
	return phase === "setup"
		? "프로젝트 시작"
		: phase === "planning"
			? "기획 단계"
			: "개발 단계";
}
