/**
 * Zod schemas for runtime validation.
 * Paired with the TypeScript types in `./entities`.
 *
 * Use these whenever data crosses a trust boundary:
 * - Reading from Vault files (user may have edited them)
 * - Parsing LLM responses
 * - Receiving payloads from the server (v2)
 */

import { z } from "zod";

// ───────────────────────── Enums ─────────────────────────

export const RoleSchema = z.enum(["READ", "WRITE", "ADMIN"]);
export const ProjectStatusSchema = z.enum(["CREATED", "PLANNING", "DEVELOPMENT", "COMPLETED"]);
export const TaskPrioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const TaskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]);
export const TaskPhaseSchema = z.enum(["PLANNING", "DEVELOPMENT"]);
export const MeetingTypeSchema = z.enum(["REGULAR", "ADHOC"]);
export const MeetingStatusSchema = z.enum(["SCHEDULED", "TOPIC_PENDING", "COMPLETED"]);
export const TopicSourceSchema = z.enum(["AI", "MANUAL"]);

export const WeekdaySchema = z.number().int().min(0).max(6);

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date YYYY-MM-DD");
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

// ───────────────────────── Core schemas ─────────────────────────

export const TimeSlotSchema = z.object({
	day: WeekdaySchema,
	startMinute: z.number().int().min(0).max(1440),
	endMinute: z.number().int().min(0).max(1440),
}).refine((slot) => slot.endMinute > slot.startMinute, {
	message: "endMinute must be greater than startMinute",
});

export const ProjectSchema = z.object({
	id: z.string().min(1),
	topic: z.string().min(5).max(200),
	description: z.string().max(1000).optional(),
	deadline: IsoDateSchema,
	createdAt: IsoDateTimeSchema,
	fixedMeetingToggle: z.boolean(),
	status: ProjectStatusSchema,
});

export const MemberSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	email: z.string().email(),
	techStacks: z.array(z.string()).min(1),
	role: RoleSchema,
	isActive: z.boolean(),
	joinedAt: IsoDateTimeSchema,
});

export const TaskIdSchema = z.string().regex(/^TASK-\d+$/, "Expected TASK-<number> format");

export const TaskSchema = z.object({
	id: TaskIdSchema,
	title: z.string().min(1),
	description: z.string().optional(),
	assigneeId: z.string().nullable(),
	startDate: IsoDateSchema,
	endDate: IsoDateSchema,
	priority: TaskPrioritySchema,
	status: TaskStatusSchema,
	phase: TaskPhaseSchema,
	dependsOn: z.array(TaskIdSchema),
});

export const ChecklistItemSchema = z.object({
	id: z.string().min(1),
	taskId: TaskIdSchema,
	text: z.string().min(1),
	checked: z.boolean(),
	checkedAt: IsoDateTimeSchema.nullable(),
	checkedBy: z.string().nullable(),
});

// Meeting/Topic/Resource/Minutes schemas can be added as those features come online.
