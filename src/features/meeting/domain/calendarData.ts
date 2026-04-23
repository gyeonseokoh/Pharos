/**
 * 캘린더 뷰(PO-1-1 고정 회의 + PO-4 임시 회의) 데이터 타입.
 *
 * 한 달 단위 그리드에 회의를 표시. 이벤트 클릭 시 해당 회의 페이지 열림.
 */

export type MeetingType = "regular" | "adhoc";

export interface CalendarMeeting {
	id: string;
	title: string;
	/** ISO date `YYYY-MM-DD`. */
	date: string;
	/** `HH:MM` (24시간). */
	time: string;
	/** 분 단위. */
	durationMinutes: number;
	type: MeetingType;
	/** 회의 MD 파일 경로 (클릭 시 이동). 없으면 페이지 없음. */
	filePath?: string;
	/** 주제 개수. 0이면 "주제 미정"으로 표시. */
	topicCount: number;
}

export interface CalendarData {
	/** 회의 목록 (여러 달 걸쳐 있을 수 있음 — 필요한 월만 렌더링). */
	meetings: CalendarMeeting[];
}
