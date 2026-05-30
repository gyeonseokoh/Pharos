/**
 * VaultTeamRepository — Vault .md 기반 TeamRepository + InviteRepository 구현.
 *
 * 2단계 구현체. 설계 문서 4.5절 기준:
 *   - 팀원: `{projectRoot}/Team/{name}.md` (1명 = 1파일)
 *   - 초대: `{projectRoot}/Team/_invites.md` (초대 목록 단일 파일, frontmatter 배열)
 *
 * 교체 방법: main.ts 에서
 *   new SettingsTeamRepository(this)  → new VaultTeamRepository(this)
 *   new SettingsInviteRepository(this) → new VaultInviteRepository(this)
 */

import type { TFile, Vault } from "obsidian";
import { parseFrontmatter, stringifyFrontmatter } from "../../../shared/repo/frontmatter";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { ChangeEvent, Disposable } from "../../../shared/repo/types";
import { InviteV1, MemberV1 } from "../domain/teamSchema";
import type { Invite, Member, MemberPermission, MemberStatus } from "../domain/teamSchema";
import type { InviteRepository, TeamRepository } from "./teamRepository";
import type { PharosPluginLike } from "../../../app/settings";

// ─────────────────────────────── VaultTeamRepository ───────────────────────────────

export class VaultTeamRepository implements TeamRepository {
	private readonly vault: Vault;
	private readonly listeners = new Set<(event: ChangeEvent<Member>) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		this.vault = plugin.app.vault;

		plugin.registerEvent(
			this.vault.on("create", (file) => {
				if (this.isMemberFile(file.path)) void this.onFileChanged(file.path, "created");
			}),
		);
		plugin.registerEvent(
			this.vault.on("modify", (file) => {
				if (this.isMemberFile(file.path)) void this.onFileChanged(file.path, "updated");
			}),
		);
		plugin.registerEvent(
			this.vault.on("delete", (file) => {
				// 팀원 파일명은 {name}.md (id 기반 X) → 삭제 시 id 특정 불가.
				// VaultMeetingRepository와 동일하게 전체 목록 "updated" 통지로 UI 갱신.
				if (this.isMemberFile(file.path)) {
					void this.list().then((all) => {
						for (const m of all) {
							this.emit({ kind: "updated", entity: m, before: m });
						}
					});
				}
			}),
		);
	}

	private teamDir(): string {
		return `${this.plugin.settings.projectRoot}/Team`;
	}

	private filePath(member: Member): string {
		// 설계 문서 4.5절: Team/{name}.md
		return `${this.teamDir()}/${member.name}.md`;
	}

	private isMemberFile(path: string): boolean {
		return (
			path.startsWith(this.teamDir() + "/") &&
			path.endsWith(".md") &&
			!path.endsWith("_invites.md")
		);
	}

	async list(): Promise<Member[]> {
		const files = this.vault.getFiles().filter((f) => this.isMemberFile(f.path));
		const results = await Promise.all(files.map((f) => this.parseFile(f)));
		return results.filter((m): m is Member => m !== null);
	}

	async listActive(): Promise<Member[]> {
		return (await this.list()).filter((m) => m.status === "active");
	}

	async getById(id: string): Promise<Member | null> {
		const all = await this.list();
		return all.find((m) => m.id === id) ?? null;
	}

	async getByEmail(email: string): Promise<Member | null> {
		const all = await this.list();
		return all.find((m) => m.email === email) ?? null;
	}

	async save(member: Member): Promise<void> {
		const next = withUpdatedMeta(member);
		const path = this.filePath(next);
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		let body = "";
		if (file) {
			const raw = await this.vault.read(file);
			body = parseFrontmatter(raw).body;
		}
		const md = stringifyFrontmatter(next as unknown as Record<string, unknown>, body);
		await this.writeFile(path, md);
	}

	async delete(id: string): Promise<void> {
		const member = await this.getById(id);
		if (!member) return;
		const file = this.vault.getAbstractFileByPath(this.filePath(member)) as TFile | null;
		if (file) await this.vault.delete(file);
	}

	async setStatus(id: string, status: MemberStatus): Promise<void> {
		const member = await this.getById(id);
		if (!member) return;
		await this.save({ ...member, status });
	}

	watch(callback: (event: ChangeEvent<Member>) => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	// ─── internals ───

	private async parseFile(file: TFile): Promise<Member | null> {
		try {
			const raw = await this.vault.read(file);
			const { meta } = parseFrontmatter<Record<string, unknown>>(raw);
			const result = MemberV1.safeParse(meta);
			if (!result.success) {
				console.error(`[Pharos] ${file.path} 파싱 실패:`, result.error.flatten());
				return null;
			}
			return result.data;
		} catch (err) {
			console.error(`[Pharos] ${file.path} 읽기 실패:`, err);
			return null;
		}
	}

	private async onFileChanged(path: string, kind: "created" | "updated"): Promise<void> {
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		if (!file) return;
		const member = await this.parseFile(file);
		if (!member) return;
		if (kind === "created") {
			this.emit({ kind: "created", entity: member });
		} else {
			this.emit({ kind: "updated", entity: member, before: member });
		}
	}

	private async writeFile(path: string, md: string): Promise<void> {
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		if (file) {
			await this.vault.modify(file, md);
		} else {
			const dir = this.teamDir();
			if (!this.vault.getAbstractFileByPath(dir)) {
				await this.vault.createFolder(dir);
			}
			await this.vault.create(path, md);
		}
	}

	private emit(event: ChangeEvent<Member>): void {
		for (const listener of this.listeners) {
			try { listener(event); } catch (err) {
				console.error("[Pharos] TeamRepository listener error:", err);
			}
		}
	}
}

// ─────────────────────────────── VaultInviteRepository ───────────────────────────────

/**
 * 초대는 단일 파일(`_invites.md`)에 frontmatter 배열로 저장.
 * 초대 수는 적고 공유/만료 처리가 필요해 단일 파일이 적합.
 */
export class VaultInviteRepository implements InviteRepository {
	private readonly vault: Vault;
	private readonly listeners = new Set<(event: ChangeEvent<Invite>) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		this.vault = plugin.app.vault;

		plugin.registerEvent(
			this.vault.on("modify", (file) => {
				if (file.path === this.filePath()) void this.notifyAll();
			}),
		);
	}

	private filePath(): string {
		return `${this.plugin.settings.projectRoot}/Team/_invites.md`;
	}

	private async readAll(): Promise<Invite[]> {
		const file = this.vault.getAbstractFileByPath(this.filePath()) as TFile | null;
		if (!file) return [];
		const raw = await this.vault.read(file);
		const { meta } = parseFrontmatter<{ invites?: unknown[] }>(raw);
		const invites = meta.invites ?? [];
		return invites
			.map((i) => InviteV1.safeParse(i))
			.filter((r): r is { success: true; data: Invite } => r.success)
			.map((r) => r.data);
	}

	private async writeAll(invites: Invite[]): Promise<void> {
		const md = stringifyFrontmatter({ invites } as Record<string, unknown>, "");
		const file = this.vault.getAbstractFileByPath(this.filePath()) as TFile | null;
		if (file) {
			await this.vault.modify(file, md);
		} else {
			const dir = `${this.plugin.settings.projectRoot}/Team`;
			if (!this.vault.getAbstractFileByPath(dir)) {
				await this.vault.createFolder(dir);
			}
			await this.vault.create(this.filePath(), md);
		}
	}

	async list(): Promise<Invite[]> {
		return this.readAll();
	}

	async listActive(): Promise<Invite[]> {
		const now = new Date().toISOString();
		return (await this.readAll()).filter((i) => i.expiresAt > now);
	}

	async getById(id: string): Promise<Invite | null> {
		return (await this.readAll()).find((i) => i.id === id) ?? null;
	}

	async save(invite: Invite): Promise<void> {
		const next = withUpdatedMeta(invite);
		const all = await this.readAll();
		const idx = all.findIndex((i) => i.id === next.id);
		if (idx >= 0) { all[idx] = next; } else { all.push(next); }
		await this.writeAll(all);
	}

	async delete(id: string): Promise<void> {
		const all = (await this.readAll()).filter((i) => i.id !== id);
		await this.writeAll(all);
	}

	async listByPermission(permission: MemberPermission): Promise<Invite[]> {
		return (await this.readAll()).filter((i) => i.permission === permission);
	}

	watch(callback: (event: ChangeEvent<Invite>) => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	private async notifyAll(): Promise<void> {
		const all = await this.readAll();
		for (const invite of all) {
			for (const listener of this.listeners) {
				try { listener({ kind: "updated", entity: invite, before: invite }); } catch {}
			}
		}
	}
}
