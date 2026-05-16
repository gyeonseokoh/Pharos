/**
 * Agent 기능 입출력 타입 계약(contract).
 *
 * 각 에이전트 기능의 Input / Result 타입을 이 파일에서 선언.
 * 도메인 로직 없음 — Service 레이어에서만 생성·소비.
 */

// ─── 1. 일정 조율 ────────────────────────────────────────────────────────────

/** 일정 조율 에이전트 입력. */
export interface ScheduleCoordinationInput {
	/** 조율할 주 월요일 ISO date (예: "2026-05-04"). */
	weekStart: string;
	/**
	 * 조율 대상 팀원 ID 목록.
	 * 생략 시 전체 활성 팀원 대상.
	 */
	participantIds?: string[];
	/** 공통 슬롯 인정 기준 최소 참여 인원 (기본 2). */
	minParticipants?: number;
	/** 원하는 회의 소요 시간(분). AI가 슬롯 필터링 시 참고. 기본 60. */
	meetingDurationMinutes?: number;
}

/** AI가 추천하는 단일 회의 후보 슬롯. */
export interface MeetingSlotRecommendation {
	/** 요일 (0=일 ~ 6=토). */
	day: number;
	/** 해당 요일의 ISO date (예: "2026-05-05"). */
	date: string;
	/** 시작 시간 "HH:MM". */
	start: string;
	/** 종료 시간 "HH:MM". */
	end: string;
	/** 해당 슬롯에 참여 가능한 팀원 이름 목록. */
	availableMembers: string[];
	/** AI가 이 슬롯을 추천하는 이유 (한국어). */
	reason: string;
}

/** 일정 조율 에이전트 결과. */
export interface ScheduleCoordinationResult {
	weekStart: string;
	/** 최대 3개 추천 슬롯. 공통 가용시간이 없으면 빈 배열. */
	recommendations: MeetingSlotRecommendation[];
	/** AI가 작성한 전체 일정 조율 결과 요약 (한국어). */
	summary: string;
}
