/**
 * 회의 목록 뷰 데이터 타입.
 *
 * 회의 접근의 주 경로. 캘린더는 날짜 기반 편의 뷰, 이건 "모든 회의 색인".
 */

import type { MeetingType } from "./calendarData";
import type { MeetingStatus } from "./meetingPageData";

export interface MeetingListItem {
	id: string;
	title: string;
	/** ISO date. */
	date: string;
	/** HH:MM. */
	time: string;
	durationMinutes: number;
	type: MeetingType;
	status: MeetingStatus;
	topicCount: number;
	attendeeCount: number;
	/** 회의가 완료됐으면 회의록 작성 여부. */
	hasMinutes: boolean;
}

export interface MeetingsListData {
	meetings: MeetingListItem[];
	// ── [DEMO] mock 데이터 기준 "오늘" 날짜 주입용 ────────────────────────────────
	// demoMode에서만 meetingsListMock.ts가 MOCK_TODAY를 넣어줌.
	// 실서비스에서는 이 필드를 설정하지 않으면 뷰가 new Date()로 fallback.
	// 연동 완료 후 이 필드와 MeetingsListView의 referenceDate 참조 줄을 삭제하세요.
	referenceDate?: string;
}
