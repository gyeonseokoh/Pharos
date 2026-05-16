/**
 * Meeting 엔티티 Zod 스키마.
 *
 * 회의 1건 = 파일 1개 (`Pharos/Meetings/<date>_<slug>.md`).
 * Topic·Resource·Minutes·Analysis는 임베드.
 */

import { z } from "zod";

export const MeetingType = z.enum(["regular", "adhoc"]);
export type MeetingType = z.infer<typeof MeetingType>;

export const MeetingStatus = z.enum([
	"topic_pending",
	"ready",
	"completed",
]);
export type MeetingStatus = z.infer<typeof MeetingStatus>;

export const MemberRole = z.enum(["PO", "PM"]);
export type MemberRole = z.infer<typeof MemberRole>;

export const TopicSource = z.enum(["AI", "MANUAL"]);
export type TopicSource = z.infer<typeof TopicSource>;

export const MeetingCategory = z.enum(["feature", "progress"]);
export type MeetingCategory = z.infer<typeof MeetingCategory>;

export const MeetingAttendee = z.object({
	id: z.string(),
	name: z.string(),
	role: MemberRole,
	attended: z.boolean().nullable(),
});
export type MeetingAttendee = z.infer<typeof MeetingAttendee>;

export const MeetingTopic = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().optional(),
	priority: z.number().int().min(1).max(5),
	source: TopicSource,
	reason: z.string().nullable(),
});
export type MeetingTopic = z.infer<typeof MeetingTopic>;

export const MeetingResource = z.object({
	id: z.string(),
	topicId: z.string().nullable(),
	title: z.string(),
	summary: z.string(),
	sourceUrl: z.string(),
	collectedAt: z.string(),
});
export type MeetingResource = z.infer<typeof MeetingResource>;

export const MeetingMinutes = z.object({
	authorName: z.string(),
	writtenAt: z.string(),
	/** 본문 텍스트. .md body에 저장되지만 메모리 모델에선 같이 다룸. */
	content: z.string(),
});
export type MeetingMinutes = z.infer<typeof MeetingMinutes>;

export const MeetingAnalysis = z.object({
	keywords: z.array(z.string()),
	techStacks: z.array(z.string()),
	decisions: z.array(z.string()),
	summary: z.string(),
	categories: z.array(MeetingCategory),
	analyzedAt: z.string(),
});
export type MeetingAnalysis = z.infer<typeof MeetingAnalysis>;

/**
 * Meeting v1 — 회의 1건.
 */
export const MeetingV1 = z.object({
	version: z.literal(1),
	type: z.literal("meeting"),
	id: z.string(),
	title: z.string(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	time: z.string().regex(/^\d{2}:\d{2}$/),
	durationMinutes: z.number().int().positive(),
	meetingType: MeetingType,
	status: MeetingStatus,
	attendees: z.array(MeetingAttendee),
	topics: z.array(MeetingTopic),
	resources: z.array(MeetingResource),
	minutes: MeetingMinutes.nullable(),
	analysis: MeetingAnalysis.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Meeting = z.infer<typeof MeetingV1>;

/**
 * 회의록 첨부 시 받는 입력. Service.attachMinutes 가 이걸로 분석·저장 처리.
 */
export interface AttachMinutesInput {
	meetingId: string;
	content: string;
	authorName: string;
}

/**
 * 회의 필터. listByXxx 메서드의 매개변수.
 */
export interface MeetingFilter {
	status?: MeetingStatus;
	meetingType?: MeetingType;
	category?: MeetingCategory;
	dateFrom?: string;
	dateTo?: string;
}
