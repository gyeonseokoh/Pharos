/**
 * AvailabilityRepository — 주간 가용시간 엔티티 데이터 접근 인터페이스.
 *
 * docs/architecture/repository-design.md 5.2절 기준.
 * 주차(ISO weekStart) 단위로 팀원 전체의 가용시간 슬롯을 관리.
 *
 * 구현체:
 *   - SettingsAvailabilityRepository  (1단계, data.json 기반, 현재 사용)
 *   - VaultAvailabilityRepository     (2단계, Pharos/Availability/*.md 기반)
 *   - HocuspocusAvailabilityRepository (3단계, 백엔드 실시간 동기화) ← 백엔드 연결 지점
 */

import type { Disposable } from "../../../shared/repo/types";
import type { Availability, AvailabilitySlot } from "../domain/availabilitySchema";

export interface AvailabilityRepository {
	/** 특정 주차 가용시간 조회. 입력된 적 없으면 null. */
	getByWeek(weekStart: string): Promise<Availability | null>;
	/** 특정 팀원이 참여한 모든 주차 가용시간 목록. */
	listByMember(memberId: string): Promise<Availability[]>;
	/**
	 * 특정 주차 슬롯 저장.
	 * 기존 데이터가 있으면 전체 교체(replace).
	 * 주차별 단일 인스턴스 유지.
	 */
	saveSlots(weekStart: string, slots: AvailabilitySlot[]): Promise<void>;
	/** 주차 데이터 삭제. */
	deleteByWeek(weekStart: string): Promise<void>;
	/** 변경 구독. weekStart 문자열로 어떤 주차가 바뀌었는지 전달. */
	watch(callback: (weekStart: string) => void): Disposable;
}
