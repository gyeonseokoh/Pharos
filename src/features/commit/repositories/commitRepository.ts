/**
 * CommitRepository — GitHub 커밋 캐시 데이터 접근 인터페이스.
 *
 * docs/architecture/repository-design.md 5.2절 기준.
 * 월별(YYYY-MM) 단위로 커밋 배치를 저장·조회.
 * 보존 등급 🟢 — 재생성 가능 캐시이므로 동기화 제외 대상.
 *
 * 구현체:
 *   - SettingsCommitRepository   (1단계, data.json 기반, 현재 사용)
 *   - VaultCommitRepository      (2단계, Pharos/Commits/*.md 기반)
 *   - HocuspocusCommitRepository (3단계, 백엔드 실시간 동기화) ← 백엔드 연결 지점
 */

import type { Disposable } from "../../../shared/repo/types";
import type { CommitEntry } from "../domain/commitSchema";

export interface CommitRepository {
	/** 특정 Task에 연결된 커밋 전체 조회 (월 경계 무관). */
	listByTask(taskId: string): Promise<CommitEntry[]>;
	/** 특정 월("YYYY-MM")의 커밋 목록 조회. */
	listByMonth(month: string): Promise<CommitEntry[]>;
	/**
	 * GitHub 폴링 결과 일괄 저장.
	 * 월은 각 커밋의 date 필드에서 자동 추출.
	 * 기존 sha와 중복되는 커밋은 덮어씀.
	 */
	upsertBatch(commits: CommitEntry[]): Promise<void>;
	/** 특정 월 캐시 삭제 (재폴링 시). */
	deleteByMonth(month: string): Promise<void>;
	/** 변경 구독. 변경된 월("YYYY-MM")을 전달. */
	watch(callback: (month: string) => void): Disposable;
}
