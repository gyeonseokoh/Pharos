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
 * 회의록 첨부 시 받는 입력.
 *
 * 분석 책임은 호출자(MinutesUploadModal)에게 있음:
 *   - 모달이 demoMode 분기로 시뮬레이터 / agentService.analyzeMinutes 중 선택해 분석
 *   - 그 결과를 analysis 로 전달하면 Service 는 순수 저장만 담당
 *
 * 이렇게 분리하면 MeetingsService 가 AgentService 에 직접 의존하지 않게 됨.
 */
export interface AttachMinutesInput {
	meetingId: string;
	content: string;
	authorName: string;
	analysis: MeetingAnalysis;
}

/**
 * 회의 생성 시 받는 입력. Service.create 가 메타 필드(version·type·id 등) 채움.
 * PO-4 임시 회의 / PO-1-1 정기 회의 양쪽에서 사용.
 */
export interface CreateMeetingInput {
	title: string;
	date: string;
	time: string;
	durationMinutes?: number;
	meetingType: MeetingType;
	attendees?: MeetingAttendee[];
	topics?: MeetingTopic[];
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
