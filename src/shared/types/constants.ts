/**
 * Shared constants. No runtime logic — just values.
 */

// ───────────────────────── Patterns ─────────────────────────

/** Task ID format: `TASK-1`, `TASK-042`, etc. */
export const TASK_ID_PATTERN = /^TASK-\d+$/;

/**
 * Commit message convention for linking to a Task (PM-4, PO-12).
 * Captures the task number in group 2.
 *
 * Examples that match:
 *   - `feat(TASK-001): add login API`
 *   - `fix(TASK-42): resolve null ref`
 */
export const COMMIT_TASK_PATTERN = /^(feat|fix)\(TASK-(\d+)\):/;

// ───────────────────────── Vault file layout ─────────────────────────

/**
 * All Vault paths are relative to the project root inside the Obsidian Vault.
 * See `src/shared/infra/README.md` for the full layout diagram.
 */
export const VaultPath = {
	DashboardDir: "Dashboard",
	Overview: "Dashboard/Overview.md",
	Schedule: "Dashboard/Schedule.md",
	Progress: "Dashboard/Progress.md",
	MembersDir: "Dashboard/Members",
	MeetingsDir: "Meetings",
	ResourcesDir: "Resources",

	/** Hidden directory for Pharos internal state (JSON files). */
	PharosDir: ".pharos",
	TeamJson: ".pharos/team.json",
	TasksJson: ".pharos/tasks.json",
	ChecklistsJson: ".pharos/checklists.json",
	MeetingsJson: ".pharos/meetings.json",
	SettingsJson: ".pharos/settings.json",
	FixedAvailabilityJson: ".pharos/fixed_availability.json",
	WeeklyAvailabilityDir: ".pharos/weekly_availability",
} as const;

// ───────────────────────── Server (v2) ─────────────────────────

export const ServerPort = {
	Hocuspocus: 1234,
	Http: 3000,
} as const;

// ───────────────────────── Use Case IDs ─────────────────────────

/**
 * Canonical UC identifiers. Use these as event names and log tags so
 * cross-feature references are searchable.
 */
export const UseCase = {
	Project_Create: "PO-0",
	Roadmap_Planning: "PO-1",
	Meeting_SetFixed: "PO-1-1",
	Meeting_SuggestTopic: "PO-2",
	Meeting_CollectResources: "PO-3",
	Meeting_ScheduleAdhoc: "PO-4",
	Meeting_Minutes: "PO-5",
	Roadmap_Development: "PO-6",
	Data_Structure: "PO-8",
	Team_Sync: "PO-9",
	Task_Split: "PO-11",
	Progress_Monitor: "PO-12",
	Member_FixedAvailability: "PM-1",
	Member_WeeklyAvailability: "PM-2",
	Task_Check: "PM-3",
	Task_VerifyCommit: "PM-4",
} as const;

export type UseCaseId = typeof UseCase[keyof typeof UseCase];

// ───────────────────────── Scheduler ─────────────────────────

/** KST offset from UTC in minutes. */
export const KST_OFFSET_MINUTES = 9 * 60;

export const ScheduleName = {
	DailyProgressDigest: "daily-progress-digest",
	WeeklyAvailabilityReminder: "weekly-availability-reminder",
} as const;
