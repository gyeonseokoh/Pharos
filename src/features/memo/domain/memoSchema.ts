/**
 * Memo 엔티티 스키마.
 *
 * docs/architecture/repository-design.md 4.8절 기준.
 * 사용자 자유 메모. Memos/m-001.md 에 저장.
 * 본문(body)은 .md 파일의 마크다운 본문에 저장되며,
 * frontmatter에는 메타(id·title·tags·timestamps)만 저장한다.
 *
 * ⚠️ 아카이브 — docs/시나리오.md §13 기준 "+Memo" 기능 보류.
 * 구현하지 않음. 추후 부활 시 이 파일을 기반으로 진행.
 */

import { z } from "zod";

export const MemoV1 = z.object({
	version: z.literal(1),
	type: z.literal("memo"),
	/** "m-001" 형식 */
	id: z.string().min(1),
	title: z.string().min(1),
	tags: z.array(z.string()).default([]),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Memo = z.infer<typeof MemoV1>;

/**
 * UI 폼 → Memo 엔티티 변환용 입력 타입.
 * version·type·id·createdAt·updatedAt 은 Service가 채움.
 */
export interface MemoInput {
	title: string;
	tags?: string[];
}
