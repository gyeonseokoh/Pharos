/**
 * 회의록 모음(Minutes Archive) 데이터.
 * 모든 회의록을 시간 역순으로 모아보는 뷰.
 */

import type { MeetingType } from "./calendarData";

export interface MinutesArchiveItem {
	meetingId: string;
	meetingTitle: string;
	/** ISO date. */
	meetingDate: string;
	meetingType: MeetingType;
	/** 회의록 작성자 이름. */
	authorName: string;
	/** 회의록 작성 시각 ISO datetime. */
	writtenAt: string;
	/** 회의록 첫 200자 미리보기. */
	preview: string;
	/** AI 분석 결과 summary. null이면 분석 전. */
	aiSummary: string | null;
	/** 회의록 글자 수. */
	length: number;
}

export interface MinutesArchiveData {
	items: MinutesArchiveItem[];
}
