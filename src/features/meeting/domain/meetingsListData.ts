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
}
