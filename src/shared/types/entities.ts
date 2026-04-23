/**
 * Core entity types for Pharos.
 *
 * Rules:
 * - No Obsidian/React/SDK imports here — pure types only.
 * - All dates are ISO 8601 strings (either date-only `YYYY-MM-DD` or full datetime).
 * - IDs are strings. Task IDs follow `TASK-<number>` convention.
 */

export type Role = "READ" | "WRITE" | "ADMIN";

export type ProjectStatus = "CREATED" | "PLANNING" | "DEVELOPMENT" | "COMPLETED";

export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

export type TaskPhase = "PLANNING" | "DEVELOPMENT";

export type MeetingType = "REGULAR" | "ADHOC";

export type MeetingStatus = "SCHEDULED" | "TOPIC_PENDING" | "COMPLETED";

export type TopicSource = "AI" | "MANUAL";

/**
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 * Pharos uses traditional calendar (week starts on Sunday).
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeSlot {
	day: Weekday;
	/** Minutes from 00:00 (local KST). */
	startMinute: number;
	endMinute: number;
}

// ───────────────────────── Project ─────────────────────────

export interface Project {
	id: string;
	topic: string;
	description?: string;
	/** ISO date `YYYY-MM-DD`. */
	deadline: string;
	/** ISO datetime. */
	createdAt: string;
	/**
	 * PO-0 toggle.
	 * - `true`: Team members input their fixed availability via PM-1 (when2meet).
	 * - `false`: PO enters the fixed meeting time directly.
	 */
	fixedMeetingToggle: boolean;
	status: ProjectStatus;
}

// ───────────────────────── Member ─────────────────────────

export interface Member {
	id: string;
	name: string;
	email: string;
	techStacks: string[];
	role: Role;
	/** Soft-delete flag. `false` means the member has left (PO-14, v2). */
	isActive: boolean;
	joinedAt: string;
}

export interface FixedAvailability {
	memberId: string;
	slots: TimeSlot[];
	updatedAt: string;
}

export interface WeeklyAvailability {
	memberId: string;
	/** ISO date of Sunday that starts the week. */
	weekStart: string;
	slots: TimeSlot[];
	updatedAt: string;
}

// ───────────────────────── Task ─────────────────────────

export interface Task {
	/** `TASK-<number>` format. */
	id: string;
	title: string;
	description?: string;
	/** `null` when unassigned (e.g. after a member leaves, v2). */
	assigneeId: string | null;
	startDate: string;
	endDate: string;
	priority: TaskPriority;
	status: TaskStatus;
	phase: TaskPhase;
	/** Other task IDs this depends on. */
	dependsOn: string[];
}

export interface ChecklistItem {
	id: string;
	taskId: string;
	text: string;
	checked: boolean;
	checkedAt: string | null;
	checkedBy: string | null;
}

// ───────────────────────── Meeting ─────────────────────────

export interface Meeting {
	id: string;
	projectId: string;
	scheduledAt: string;
	/** Minutes. */
	duration: number;
	type: MeetingType;
	topicIds: string[];
	attendeeIds: string[];
	status: MeetingStatus;
}

export interface Topic {
	id: string;
	meetingId: string;
	title: string;
	description?: string;
	/** 1 (highest) to 5 (lowest). */
	priority: number;
	source: TopicSource;
	/** Reason the AI suggested this topic. */
	reason?: string;
}

export interface Resource {
	id: string;
	meetingId: string;
	topicId: string;
	title: string;
	summary: string;
	sourceUrl: string;
	collectedAt: string;
}

export interface Minutes {
	id: string;
	meetingId: string;
	/** Raw text content of the meeting minutes. */
	content: string;
	keywords: string[];
	techStacks: string[];
	decisions: string[];
	summary: string;
	analyzedAt: string;
}

// ───────────────────────── Progress ─────────────────────────

export interface Commit {
	sha: string;
	message: string;
	author: string;
	/** ISO datetime. */
	date: string;
	/** Extracted from `feat(TASK-XXX):` or `fix(TASK-XXX):` pattern. `null` if unmatched. */
	taskId: string | null;
	/** `true` when the commit is linked to an existing Task. */
	verified: boolean;
}

export interface DailyMemberSummary {
	memberId: string;
	/** ISO date. */
	date: string;
	checkedItems: number;
	commits: number;
	/** Free-form AI summary of the day's activity. */
	narrative: string;
}
