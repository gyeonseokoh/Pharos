/**
 * Repository 패턴 공통 타입.
 *
 * - 모든 도메인 엔티티가 가지는 메타필드(`Entity`)
 * - 데이터 변경 이벤트(`ChangeEvent`)
 * - Repository 인터페이스(`Repository<T>`)
 *
 * 각 feature의 Repository는 이 베이스를 확장해서 도메인 특화 메서드를 추가한다.
 */

/**
 * 모든 엔티티가 공통으로 가지는 메타.
 * frontmatter v1 규약.
 */
export interface EntityMeta {
	/** 스키마 버전. 마이그레이션 트리거. */
	version: number;
	/** 엔티티 종류 식별자 (예: "meeting", "task"). 검증·디버깅용. */
	type: string;
	/** 전역 유니크 식별자. */
	id: string;
	/** ISO datetime. 생성 시점, 이후 변경 X. */
	createdAt: string;
	/** ISO datetime. 매 저장 시 갱신. */
	updatedAt: string;
}

/** 엔티티 = 메타 + 도메인 필드. */
export type Entity<T extends EntityMeta = EntityMeta> = T;

/**
 * Repository 변경 이벤트.
 * watch() 콜백으로 전달되어 UI 자동 갱신·이벤트 버스 발행에 사용.
 */
export type ChangeEvent<T extends EntityMeta> =
	| { kind: "created"; entity: T }
	| { kind: "updated"; entity: T; before: T }
	| { kind: "deleted"; id: string };

/** 구독 해제용. */
export interface Disposable {
	dispose(): void;
}

/**
 * 모든 Repository가 공통으로 갖는 베이스 인터페이스.
 *
 * 각 도메인 Repository는 이 베이스를 확장하면서
 * 도메인 특화 메서드(listByDate, listByCategory 등)를 추가.
 */
export interface Repository<T extends EntityMeta> {
	/** 전체 또는 필터 조건에 맞는 엔티티 목록. */
	list(): Promise<T[]>;
	/** ID로 단일 엔티티 조회. 없으면 null. */
	getById(id: string): Promise<T | null>;
	/** 엔티티 저장 (신규·갱신 모두). updatedAt 자동 갱신. */
	save(entity: T): Promise<void>;
	/** ID로 삭제. 없는 ID도 에러 X. */
	delete(id: string): Promise<void>;
	/** 변경 구독. dispose()로 해제. */
	watch(callback: (event: ChangeEvent<T>) => void): Disposable;
}

/**
 * 단일 인스턴스 엔티티 (예: Project, Roadmap)는
 * list/getById 대신 get/save 만 가지는 단순화 인터페이스.
 */
export interface SingletonRepository<T extends EntityMeta> {
	get(): Promise<T | null>;
	save(entity: T): Promise<void>;
	delete(): Promise<void>;
	watch(callback: (entity: T | null) => void): Disposable;
}

/**
 * Repository 구현 시 메타 자동 갱신용 헬퍼.
 *
 * save 호출 시:
 *   - `createdAt`이 없으면 현재 시각으로 설정 (신규 엔티티)
 *   - `updatedAt`은 항상 현재 시각으로 갱신
 */
export function withUpdatedMeta<T extends EntityMeta>(entity: T): T {
	const now = new Date().toISOString();
	return {
		...entity,
		createdAt: entity.createdAt || now,
		updatedAt: now,
	};
}
