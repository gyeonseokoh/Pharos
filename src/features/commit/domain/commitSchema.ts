/**
 * CommitBatch 엔티티 스키마.
 *
 * docs/architecture/repository-design.md 4.7절 기준.
 * GitHub 커밋 캐시. 월별 1파일 (Commits/2026-04.md).
 * 보존 등급 🟢 — AI 분석과 마찬가지로 재생성 가능.
 *
 * - id: "commits-2026-04" 형식.
 * - month: "YYYY-MM" 형식.
 * - commits: 해당 월의 커밋 목록. taskId가 null이면 Task 매칭 실패.
 */

import { z } from "zod";

export const CommitVerifyResultSchema = z.enum(["verified", "unverified", "rejected"]);
export type CommitVerifyResult = z.infer<typeof CommitVerifyResultSchema>;

/**
 * 커밋 단건 스키마.
 * CommitBatch 안에 배열로 저장된다.
 */
export const CommitEntryV1 = z.object({
	sha: z.string().min(1),
	/** 매칭된 Task ID. null이면 커밋 컨벤션 패턴 매칭 실패. */
	taskId: z.string().nullable(),
	message: z.string(),
	author: z.string(),
	date: z.string(),
	verifyResult: CommitVerifyResultSchema,
	filesChanged: z.number().int().min(0),
	linesAdded: z.number().int().min(0),
	linesRemoved: z.number().int().min(0),
});

export type CommitEntry = z.infer<typeof CommitEntryV1>;

/**
 * CommitBatch v1 스키마.
 * 월별 1개 인스턴스. GitHub 폴링 결과를 일괄 저장.
 */
export const CommitBatchV1 = z.object({
	version: z.literal(1),
	type: z.literal("commit-batch"),
	/** "commits-2026-04" */
	id: z.string().min(1),
	/** "YYYY-MM" */
	month: z.string().regex(/^\d{4}-\d{2}$/),
	/** 마지막 GitHub 폴링 시각 */
	syncedAt: z.string(),
	commits: z.array(CommitEntryV1).default([]),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type CommitBatch = z.infer<typeof CommitBatchV1>;
