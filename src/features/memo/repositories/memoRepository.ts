/**
 * MemoRepository — 사용자 자유 메모 데이터 접근 인터페이스.
 *
 * docs/architecture/repository-design.md 5.2절 기준.
 * 범용 Repository<Memo> 에 태그 필터 메서드 추가.
 *
 * ⚠️ 아카이브 — docs/시나리오.md §13 기준 "+Memo" 기능 보류.
 * 구현하지 않음. 추후 부활 시 이 파일을 기반으로 진행.
 *
 * 구현체 (미구현):
 *   - SettingsMemoRepository   (1단계, data.json 기반)
 *   - VaultMemoRepository      (2단계, Pharos/Memos/*.md 기반)
 *   - HocuspocusMemoRepository (3단계, 백엔드 실시간 동기화)
 */

import type { ChangeEvent, Disposable } from "../../../shared/repo/types";
import type { Memo } from "../domain/memoSchema";

export interface MemoRepository {
	/** 전체 메모 목록. */
	list(): Promise<Memo[]>;
	/** ID로 단일 메모 조회. 없으면 null. */
	getById(id: string): Promise<Memo | null>;
	/** 메모 저장 (신규·갱신). updatedAt 자동 갱신. */
	save(memo: Memo): Promise<void>;
	/** 메모 삭제. */
	delete(id: string): Promise<void>;
	/** 특정 태그가 붙은 메모만 조회. */
	listByTag(tag: string): Promise<Memo[]>;
	/** 변경 구독. dispose()로 해제. */
	watch(callback: (event: ChangeEvent<Memo>) => void): Disposable;
}
