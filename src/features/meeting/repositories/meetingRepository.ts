/**
 * MeetingRepository — 회의 엔티티 데이터 접근 인터페이스.
 *
 * 구현체:
 *   - SettingsMeetingRepository (1단계, mock + settings.attachedMinutes)
 *   - VaultMeetingRepository    (2단계, Pharos/Meetings/*.md)
 */

import type { Disposable } from "../../../shared/repo/types";
import type { ChangeEvent } from "../../../shared/repo/types";
import type {
	Meeting,
	MeetingCategory,
	MeetingFilter,
	MeetingStatus,
} from "../domain/meetingSchema";

export interface MeetingRepository {
	/** 전체 회의 목록 (필터 옵션). */
	list(filter?: MeetingFilter): Promise<Meeting[]>;
	/** ID로 단일 회의 조회. */
	getById(id: string): Promise<Meeting | null>;
	/** 회의 저장 (신규·갱신). updatedAt 자동 갱신. */
	save(meeting: Meeting): Promise<void>;
	/** 회의 삭제. */
	delete(id: string): Promise<void>;
	/** 회의록 없는 회의들 (회의록 작성 드롭다운용). */
	listMeetingsWithoutMinutes(): Promise<Meeting[]>;
	/** 카테고리별 필터. */
	listByCategory(category: MeetingCategory): Promise<Meeting[]>;
	/** 상태별 필터. */
	listByStatus(status: MeetingStatus): Promise<Meeting[]>;
	/** 변경 구독. */
	watch(callback: (event: ChangeEvent<Meeting>) => void): Disposable;
}
