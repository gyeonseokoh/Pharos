/**
 * SettingsTeamRepository / SettingsInviteRepository — settings(data.json) 기반 구현.
 *
 * 1단계 구현체. 나중에 VaultTeamRepository 또는 HocuspocusTeamRepository로
 * 교체 시 main.ts 한 줄만 바꾸면 됨.
 */

import type { PharosPluginLike } from "../../../app/settings";
import type { ChangeEvent, Disposable } from "../../../shared/repo/types";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { Invite, Member, MemberPermission, MemberStatus } from "../domain/teamSchema";
import type { InviteRepository, TeamRepository } from "./teamRepository";

export class SettingsTeamRepository implements TeamRepository {
	private listeners = new Set<(event: ChangeEvent<Member>) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		plugin.registerEvent(
			plugin.app.workspace.on("pharos:state-changed" as never, () => {
				void this.notifyAll();
			}),
		);
	}

	async list(): Promise<Member[]> {
		return this.plugin.settings.members ?? [];
	}

	async listActive(): Promise<Member[]> {
		return (this.plugin.settings.members ?? []).filter((m) => m.status === "active");
	}

	async getById(id: string): Promise<Member | null> {
		return (this.plugin.settings.members ?? []).find((m) => m.id === id) ?? null;
	}

	async getByEmail(email: string): Promise<Member | null> {
		return (
			(this.plugin.settings.members ?? []).find((m) => m.email === email) ?? null
		);
	}

	async save(member: Member): Promise<void> {
		const next = withUpdatedMeta(member);
		const members = [...(this.plugin.settings.members ?? [])];
		const idx = members.findIndex((m) => m.id === next.id);

		if (idx >= 0) {
			const before = members[idx]!;
			members[idx] = next;
			this.plugin.settings.members = members;
			await this.plugin.saveSettings();
			this.emit({ kind: "updated", entity: next, before });
		} else {
			members.push(next);
			this.plugin.settings.members = members;
			await this.plugin.saveSettings();
			this.emit({ kind: "created", entity: next });
		}
	}

	async delete(id: string): Promise<void> {
		this.plugin.settings.members = (this.plugin.settings.members ?? []).filter(
			(m) => m.id !== id,
		);
		await this.plugin.saveSettings();
		this.emit({ kind: "deleted", id });
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

	private emit(event: ChangeEvent<Member>): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (err) {
				console.error("[Pharos] TeamRepository listener error:", err);
			}
		}
	}

	private async notifyAll(): Promise<void> {
		const members = await this.list();
		for (const member of members) {
			this.emit({ kind: "updated", entity: member, before: member });
		}
	}
}

export class SettingsInviteRepository implements InviteRepository {
	private listeners = new Set<(event: ChangeEvent<Invite>) => void>();

	constructor(private readonly plugin: PharosPluginLike) {}

	async list(): Promise<Invite[]> {
		return this.plugin.settings.invites ?? [];
	}

	async listActive(): Promise<Invite[]> {
		const now = new Date().toISOString();
		return (this.plugin.settings.invites ?? []).filter(
			(inv) => inv.expiresAt > now,
		);
	}

	async getById(id: string): Promise<Invite | null> {
		return (
			(this.plugin.settings.invites ?? []).find((inv) => inv.id === id) ?? null
		);
	}

	async save(invite: Invite): Promise<void> {
		const next = withUpdatedMeta(invite);
		const invites = [...(this.plugin.settings.invites ?? [])];
		const idx = invites.findIndex((inv) => inv.id === next.id);

		if (idx >= 0) {
			const before = invites[idx]!;
			invites[idx] = next;
			this.plugin.settings.invites = invites;
			await this.plugin.saveSettings();
			this.emit({ kind: "updated", entity: next, before });
		} else {
			invites.push(next);
			this.plugin.settings.invites = invites;
			await this.plugin.saveSettings();
			this.emit({ kind: "created", entity: next });
		}
	}

	async delete(id: string): Promise<void> {
		this.plugin.settings.invites = (this.plugin.settings.invites ?? []).filter(
			(inv) => inv.id !== id,
		);
		await this.plugin.saveSettings();
		this.emit({ kind: "deleted", id });
	}

	async listByPermission(permission: MemberPermission): Promise<Invite[]> {
		return (this.plugin.settings.invites ?? []).filter(
			(inv) => inv.permission === permission,
		);
	}

	watch(callback: (event: ChangeEvent<Invite>) => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	private emit(event: ChangeEvent<Invite>): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (err) {
				console.error("[Pharos] InviteRepository listener error:", err);
			}
		}
	}
}
