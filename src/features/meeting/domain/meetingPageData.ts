/**
 * 회의 페이지(MeetingPage) 데이터 타입.
 *
 * 캘린더에서 회의를 클릭하면 열리는 상세 페이지.
 * 포함 UC: PO-2 회의 주제, PO-3 회의 자료, PO-5 회의록, PM-4 분석.
 */

import type { MeetingType } from "./calendarData";

export type MeetingStatus =
	/** 주제·자료 아직 준비 안 됨. */
	| "topic_pending"
	/** 준비 완료, 회의 예정. */
	| "ready"
	/** 회의 완료, 회의록 작성됨. */
	| "completed";

export type MemberRole = "PO" | "PM";
export type TopicSource = "AI" | "MANUAL";

export interface MeetingAttendee {
	id: string;
	name: string;
	role: MemberRole;
	/** 실제 참석 여부 (회의 후 체크). 미정이면 null. */
	attended: boolean | null;
}

export interface MeetingTopic {
	id: string;
	title: string;
	description?: string;
	/** 1=최우선, 5=최하. */
	priority: number;
	source: TopicSource;
	/** AI가 제안한 이유 (MANUAL이면 null). */
	reason: string | null;
}

export interface MeetingResource {
	id: string;
	/** 어느 주제에 연결된 자료인지. null이면 회의 전체 공용. */
	topicId: string | null;
	title: string;
	summary: string;
	sourceUrl: string;
	/** ISO datetime. */
	collectedAt: string;
}

export interface MeetingMinutes {
	/** 자유형 텍스트 (Obsidian 에디터로 작성). */
	content: string;
	/** 작성자 이름. */
	authorName: string;
	/** ISO datetime. */
	writtenAt: string;
}

export interface MeetingAnalysis {
	keywords: string[];
	techStacks: string[];
	decisions: string[];
	/** AI가 생성한 한 문단 요약. */
	summary: string;
	/** ISO datetime. */
	analyzedAt: string;
}

/**
 * MeetingPageView가 받는 데이터.
 */
export interface MeetingPageData {
	id: string;
	title: string;
	/** ISO date. */
	date: string;
	/** HH:MM. */
	time: string;
	durationMinutes: number;
	type: MeetingType;
	status: MeetingStatus;
	attendees: MeetingAttendee[];
	topics: MeetingTopic[];
	resources: MeetingResource[];
	/** 회의록. 아직 작성 전이면 null. */
	minutes: MeetingMinutes | null;
	/** AI 분석 결과. 회의록 작성 전이면 null. */
	analysis: MeetingAnalysis | null;
}
