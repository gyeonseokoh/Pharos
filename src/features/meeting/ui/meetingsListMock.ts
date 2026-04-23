/**
 * 회의 목록 목업 데이터.
 * 기존 calendarMock + meetingPageMock을 종합한 리스트.
 */

import { mockCalendarData } from "./calendarMock";
import { meetingPageMocks } from "./meetingPageMock";
import type {
	MeetingListItem,
	MeetingsListData,
} from "../domain/meetingsListData";
import type { MeetingStatus } from "../domain/meetingPageData";

const today = "2026-04-24";

/** 회의 ID로 풀 데이터가 있으면 그걸 쓰고, 없으면 캘린더 데이터 + 추정 상태. */
function toListItem(meetingId: string): MeetingListItem | null {
	const cal = mockCalendarData.meetings.find((m) => m.id === meetingId);
	if (!cal) return null;

	const page = meetingPageMocks[meetingId];

	// 상태 추정: 풀 데이터 있으면 그 status, 없으면 날짜 기반
	let status: MeetingStatus;
	if (page) {
		status = page.status;
	} else if (cal.date < today) {
		// 과거 회의인데 풀 데이터 없음 → 완료(회의록 미작성)로 표시
		status = "completed";
	} else {
		// 미래 회의 → 주제 준비 여부로 판단
		status = cal.topicCount > 0 ? "ready" : "topic_pending";
	}

	return {
		id: cal.id,
		title: cal.title,
		date: cal.date,
		time: cal.time,
		durationMinutes: cal.durationMinutes,
		type: cal.type,
		status,
		topicCount: page?.topics.length ?? cal.topicCount,
		attendeeCount: page?.attendees.length ?? 0,
		hasMinutes: page?.minutes !== null && page?.minutes !== undefined,
	};
}

export const mockMeetingsListData: MeetingsListData = {
	meetings: mockCalendarData.meetings
		.map((m) => toListItem(m.id))
		.filter((m): m is MeetingListItem => m !== null)
		// 최신 날짜가 위로
		.sort((a, b) => b.date.localeCompare(a.date)),
};
