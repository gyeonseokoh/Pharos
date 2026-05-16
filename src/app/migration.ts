/**
 * Pharos 데이터 마이그레이션 — data.json → Vault .md 파일.
 *
 * 설계 문서 §7 기준.
 * 트리거: 플러그인 로드 시 settings.migrated !== true 이면 실행.
 *
 * 변환 대상:
 *   settings.projectReport          → {root}/project.md
 *   settings.roadmaps               → {root}/Roadmap/planning.md, development.md
 *   settings.tasks                  → {root}/Tasks/TASK-NNN.md
 *   mockTeamListData.members + settings.members → {root}/Team/{name}.md
 *   mockTeamListData.pendingInvites + settings.invites → {root}/Team/_invites.md
 *   settings.availabilities         → {root}/Availability/{weekStart}.md
 *   settings.commitBatches          → {root}/Commits/{month}.md
 *   meetingPageMocks + attachedMinutes → {root}/Meetings/{date}_{slug}.md
 *
 * 실패 시 생성된 .md 파일 전부 롤백.
 */

import type { App, TFile } from "obsidian";
import { Modal, Notice } from "obsidian";
import { stringifyFrontmatter } from "../shared/repo/frontmatter";
import { withUpdatedMeta } from "../shared/repo/types";
import {
	applyAttachedMinutes,
	meetingPageMocks,
} from "../features/meeting/ui/meetingPageMock";
import { mockTeamListData } from "../features/team/ui/teamListMock";
import type { PharosPluginLike } from "./settings";
import type { Project } from "../features/project/domain/projectSchema";
import type { Meeting } from "../features/meeting/domain/meetingSchema";
import type { Task } from "../features/task/domain/taskSchema";
import type { Member, Invite } from "../features/team/domain/teamSchema";
import type { Availability } from "../features/availability/domain/availabilitySchema";
import type { CommitBatch } from "../features/commit/domain/commitSchema";
import type { Roadmap } from "../features/roadmap/domain/roadmapSchema";

// ─── 마이그레이션 실행 ───────────────────────────────────────────────────────

export async function runMigrationIfNeeded(plugin: PharosPluginLike): Promise<void> {
	if (plugin.settings.migrated) return;

	await new Promise<void>((resolve) => {
		new MigrationModal(plugin.app, plugin, resolve).open();
	});
}

// ─── 마이그레이션 모달 ────────────────────────────────────────────────────────

class MigrationModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: PharosPluginLike,
		private readonly onDone: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Pharos 데이터 형식 업그레이드" });

		const s = this.plugin.settings;
		const meetingCount = Object.keys(meetingPageMocks).length;
		const taskCount = (s.tasks ?? []).length;
		// mockTeamListData.members + settings.members 합집합 (중복 id 제거)
		const memberIds = new Set([
			...mockTeamListData.members.map((m) => m.id),
			...(s.members ?? []).map((m) => m.id),
		]);
		const memberCount = memberIds.size;
		const roadmapCount = Object.keys(s.roadmaps ?? {}).length;

		contentEl.createEl("p", {
			text: "Pharos가 모든 데이터를 옵시디언 마크다운 파일로 저장하도록 업그레이드됩니다.",
		});

		const list = contentEl.createEl("ul");
		if (s.projectReport) list.createEl("li", { text: "프로젝트 정보 1건" });
		if (meetingCount > 0) list.createEl("li", { text: `회의 ${meetingCount}건` });
		if (roadmapCount > 0) list.createEl("li", { text: `로드맵 ${roadmapCount}개` });
		if (taskCount > 0) list.createEl("li", { text: `Task ${taskCount}건` });
		if (memberCount > 0) list.createEl("li", { text: `팀원 ${memberCount}명` });

		contentEl.createEl("p", { text: "소요 시간: 약 5초" });
		contentEl.createEl("p", { text: "실패 시 자동 복구됩니다." });

		const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
		btnRow.createEl("button", { text: "나중에" }).addEventListener("click", () => {
			this.close();
			this.onDone();
		});

		const confirmBtn = btnRow.createEl("button", {
			text: "업그레이드 시작",
			cls: "mod-cta",
		});
		confirmBtn.addEventListener("click", async () => {
			confirmBtn.disabled = true;
			confirmBtn.textContent = "마이그레이션 중...";
			try {
				await migrate(this.plugin);
				new Notice("[Pharos] 마이그레이션 완료! 이제 .md 파일로 저장됩니다.");
			} catch (err) {
				console.error("[Pharos] 마이그레이션 실패:", err);
				new Notice("[Pharos] 마이그레이션 실패. data.json 데이터를 복구했습니다.");
			}
			this.close();
			this.onDone();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

// ─── 실제 마이그레이션 로직 ─────────────────────────────────────────────────

async function migrate(plugin: PharosPluginLike): Promise<void> {
	const { vault } = plugin.app;
	const root = plugin.settings.projectRoot;
	const created: string[] = [];

	const write = async (path: string, md: string): Promise<void> => {
		const dir = path.substring(0, path.lastIndexOf("/"));
		if (dir && !vault.getAbstractFileByPath(dir)) {
			await vault.createFolder(dir);
		}
		const existing = vault.getAbstractFileByPath(path) as TFile | null;
		if (existing) {
			await vault.modify(existing, md);
		} else {
			await vault.create(path, md);
			created.push(path);
		}
	};

	try {
		// 1. Project
		if (plugin.settings.projectReport) {
			const r = plugin.settings.projectReport;
			const project: Project = withUpdatedMeta({
				version: 1,
				type: "project",
				id: "proj-pharos",
				name: r.name,
				description: r.description,
				deadline: r.deadline,
				fixedMeetingMode: r.fixedMeetingMode,
				fixedMeetingDay: r.fixedMeetingDay,
				fixedMeetingTime: r.fixedMeetingTime,
				planningRoadmapGenerated: plugin.settings.planningRoadmapGenerated,
				developmentRoadmapGenerated: plugin.settings.developmentRoadmapGenerated,
				workspaceId: "",
				createdAt: r.createdAt,
				updatedAt: r.createdAt,
			});
			await write(
				`${root}/project.md`,
				stringifyFrontmatter(project as unknown as Record<string, unknown>, `# ${project.name}\n`),
			);
		}

		// 2. Meetings (meetingPageMocks + attachedMinutes 병합)
		for (const [id, mock] of Object.entries(meetingPageMocks)) {
			const merged = applyAttachedMinutes(mock, plugin.settings.attachedMinutes);
			const now = new Date().toISOString();
			const meeting: Meeting = withUpdatedMeta({
				version: 1,
				type: "meeting",
				id,
				title: merged.title,
				date: merged.date,
				time: merged.time,
				durationMinutes: merged.durationMinutes,
				meetingType: merged.type,
				status: merged.status,
				attendees: merged.attendees,
				topics: merged.topics.map((t) => ({
					id: t.id,
					title: t.title,
					description: t.description,
					priority: t.priority,
					source: t.source,
					reason: t.reason,
				})),
				resources: merged.resources,
				minutes: merged.minutes
					? {
							authorName: merged.minutes.authorName,
							writtenAt: merged.minutes.writtenAt,
							content: merged.minutes.content,
					  }
					: null,
				analysis: merged.analysis ?? null,
				createdAt: merged.minutes?.writtenAt ?? now,
				updatedAt: merged.analysis?.analyzedAt ?? merged.minutes?.writtenAt ?? now,
			});

			const slug = meeting.title
				.toLowerCase()
				.replace(/\s+/g, "-")
				.replace(/[^\w가-힣-]/g, "")
				.slice(0, 40);
			const path = `${root}/Meetings/${meeting.date}_${slug}.md`;

			// minutes.content → body, 나머지 → frontmatter
			const { minutes, ...meta } = meeting;
			const frontmatter = {
				...meta,
				minutes: minutes ? { authorName: minutes.authorName, writtenAt: minutes.writtenAt } : null,
			};
			const body = minutes?.content ?? `# ${meeting.title}\n`;
			await write(path, stringifyFrontmatter(frontmatter as unknown as Record<string, unknown>, body));
		}

		// 3. Roadmaps
		for (const [kind, roadmap] of Object.entries(plugin.settings.roadmaps ?? {})) {
			const filename = kind === "PLANNING" ? "planning.md" : "development.md";
			const r = roadmap as Roadmap;
			await write(
				`${root}/Roadmap/${filename}`,
				stringifyFrontmatter(withUpdatedMeta(r) as unknown as Record<string, unknown>, ""),
			);
		}

		// 4. Tasks
		for (const task of plugin.settings.tasks ?? []) {
			const t = task as Task;
			const next = withUpdatedMeta(t);
			await write(
				`${root}/Tasks/${next.id}.md`,
				stringifyFrontmatter(next as unknown as Record<string, unknown>, `# ${next.title}\n`),
			);
		}

		// 5. Team members — mockTeamListData(시연용) + settings.members(사용자 저장) 병합.
		//    settings.members가 동일 id를 가지면 사용자 데이터를 우선.
		const memberMap = new Map<string, Member>();

		for (const mock of mockTeamListData.members) {
			const m: Member = withUpdatedMeta({
				version: 1,
				type: "team-member",
				id: mock.id,
				name: mock.name,
				email: mock.email,
				role: mock.role,
				permission: mock.permission,
				techStacks: mock.techStacks,
				status: mock.isActive ? "active" : "left",
				joinedAt: mock.joinedAt,
				createdAt: mock.joinedAt,
				updatedAt: mock.joinedAt,
			});
			memberMap.set(m.id, m);
		}
		for (const member of plugin.settings.members ?? []) {
			// 사용자가 저장한 데이터가 있으면 mock 위에 덮어씀
			memberMap.set(member.id, withUpdatedMeta(member as Member));
		}
		for (const m of memberMap.values()) {
			await write(
				`${root}/Team/${m.name}.md`,
				stringifyFrontmatter(m as unknown as Record<string, unknown>, `# ${m.name}\n`),
			);
		}

		// 6. Invites (단일 파일) — mockTeamListData.pendingInvites + settings.invites 병합.
		const inviteMap = new Map<string, Invite>();
		for (const pending of mockTeamListData.pendingInvites) {
			const inv: Invite = withUpdatedMeta({
				version: 1,
				type: "invite",
				id: pending.id,
				email: pending.email,
				permission: pending.permission,
				invitedAt: pending.invitedAt,
				expiresAt: pending.expiresAt,
				createdAt: pending.invitedAt,
				updatedAt: pending.invitedAt,
			});
			inviteMap.set(inv.id, inv);
		}
		for (const invite of plugin.settings.invites ?? []) {
			inviteMap.set(invite.id, withUpdatedMeta(invite as Invite));
		}
		if (inviteMap.size > 0) {
			const invites = [...inviteMap.values()];
			await write(
				`${root}/Team/_invites.md`,
				stringifyFrontmatter({ invites } as unknown as Record<string, unknown>, ""),
			);
		}

		// 7. Availability — 파일명은 설계 문서 §4.6 기준 ISO 주차 형식 (YYYY-W##.md)
		for (const avail of plugin.settings.availabilities ?? []) {
			const a = avail as Availability;
			const next = withUpdatedMeta(a);
			const isoWeek = weekStartToISOWeek(next.weekStart);
			await write(
				`${root}/Availability/${isoWeek}.md`,
				stringifyFrontmatter(next as unknown as Record<string, unknown>, ""),
			);
		}

		// 8. Commits
		for (const batch of plugin.settings.commitBatches ?? []) {
			const b = batch as CommitBatch;
			const next = withUpdatedMeta(b);
			await write(
				`${root}/Commits/${next.month}.md`,
				stringifyFrontmatter(next as unknown as Record<string, unknown>, ""),
			);
		}

		// 마이그레이션 완료 플래그
		plugin.settings.migrated = true;
		await plugin.saveSettings();

	} catch (err) {
		// 실패 시 생성된 파일 롤백
		for (const path of created) {
			const f = vault.getAbstractFileByPath(path) as TFile | null;
			if (f) {
				try { await vault.delete(f); } catch {}
			}
		}
		throw err;
	}
}

// ─── 유틸리티 ─────────────────────────────────────────────────────────────────

/**
 * 월요일 날짜(YYYY-MM-DD) → ISO 8601 주차 문자열(YYYY-W##).
 * 설계 문서 §4.6 — Availability 파일명 컨벤션.
 *
 * 알고리즘: weekStart(월) 기준 목요일이 포함된 연도·주차를 계산.
 * ISO 8601 규칙상 목요일이 속한 해가 그 주의 연도.
 */
function weekStartToISOWeek(weekStart: string): string {
	const monday = new Date(weekStart + "T00:00:00");
	// 그 주의 목요일 = 월요일 + 3일
	const thursday = new Date(monday.getTime() + 3 * 86_400_000);
	const year = thursday.getFullYear();
	const jan1 = new Date(year, 0, 1);
	const daysDiff = Math.round((thursday.getTime() - jan1.getTime()) / 86_400_000);
	// jan1.getDay(): 0=Sun…6=Sat. 이를 이용해 1월 1일이 속한 주차에서부터 오프셋 계산.
	const weekNum = Math.ceil((daysDiff + jan1.getDay() + 1) / 7);
	return `${year}-W${String(weekNum).padStart(2, "0")}`;
}
