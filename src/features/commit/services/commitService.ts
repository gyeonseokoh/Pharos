/**
 * CommitService — GitHub 커밋 캐시 비즈니스 로직 Facade.
 *
 * UI·백엔드·AI 에이전트가 모두 이 Service를 통해 커밋 데이터를 조작.
 *
 * PM-4: feat(TASK-XXX): / fix(TASK-XXX): 패턴 매칭 → verified/unverified 2상태.
 * PO-12: 공개 진행도 페이지용 월별·Task별 커밋 조회.
 *
 * 사용:
 *   // GitHub 폴링 결과 일괄 저장
 *   await commitService.upsertBatch(rawCommits);
 *
 *   // PO-12: 특정 월 커밋 조회
 *   const commits = await commitService.listByMonth("2026-05");
 *
 *   // PM-4: 특정 Task에 연결된 커밋 조회
 *   const linked = await commitService.listByTask("TASK-001");
 */

import type { CommitEntry } from "../domain/commitSchema";
import type { CommitRepository } from "../repositories/commitRepository";

export class CommitService {
	constructor(private readonly repo: CommitRepository) {}

	/**
	 * 특정 Task에 연결된 커밋 전체 조회. (PM-4 / PO-12)
	 * 월 경계 무관하게 전체 배치를 탐색.
	 */
	async listByTask(taskId: string): Promise<CommitEntry[]> {
		console.log("test")
		return this.repo.listByTask(taskId);
	}

	/**
	 * 특정 월("YYYY-MM")의 커밋 목록 조회. (PO-12 공개 진행도)
	 */
	async listByMonth(month: string): Promise<CommitEntry[]> {
		return this.repo.listByMonth(month);
	}

	/**
	 * GitHub 폴링 결과 일괄 저장 + PM-4 커밋 컨벤션 자동 분류.
	 *
	 * - 각 커밋의 verifyResult를 커밋 메시지 패턴으로 판별:
	 *     taskId != null → "verified" (feat/fix(TASK-XXX): 패턴 성공)
	 *     taskId == null → "unverified" (패턴 매칭 실패)
	 * - 기존 sha와 중복되는 커밋은 덮어씀.
	 * - 월은 각 커밋의 date 필드에서 자동 추출 (Repository 책임).
	 *
	 * docs/시나리오.md PM-4: verified / unverified 2상태만 (v1 단순화).
	 */
	async upsertBatch(commits: CommitEntry[]): Promise<void> {
		const classified = commits.map((c) => ({
			...c,
			verifyResult: (c.taskId != null ? "verified" : "unverified") as CommitEntry["verifyResult"],
		}));
		await this.repo.upsertBatch(classified);
	}

	/**
	 * 특정 월 커밋 캐시 삭제 (재폴링 시).
	 */
	async deleteByMonth(month: string): Promise<void> {
		await this.repo.deleteByMonth(month);
	}
}
