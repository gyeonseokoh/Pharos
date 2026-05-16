/**
 * VaultCommitRepository — Vault .md 기반 CommitRepository 구현.
 *
 * 2단계 구현체. 설계 문서 4.7절 기준:
 *   `{projectRoot}/Commits/{YYYY-MM}.md` (월별 1파일)
 *
 * 보존 등급 🟢 — 재생성 가능 캐시. 경석 sync 필터에서 동기화 제외 처리 예정.
 *
 * 교체 방법: main.ts 에서
 *   new SettingsCommitRepository(this) → new VaultCommitRepository(this)
 */

import type { TFile, Vault } from "obsidian";
import { parseFrontmatter, stringifyFrontmatter } from "../../../shared/repo/frontmatter";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { Disposable } from "../../../shared/repo/types";
import { CommitBatchV1 } from "../domain/commitSchema";
import type { CommitBatch, CommitEntry } from "../domain/commitSchema";
import type { CommitRepository } from "./commitRepository";
import type { PharosPluginLike } from "../../../app/settings";

export class VaultCommitRepository implements CommitRepository {
	private readonly vault: Vault;
	private readonly listeners = new Set<(month: string) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		this.vault = plugin.app.vault;

		plugin.registerEvent(
			this.vault.on("modify", (file) => {
				const month = this.monthFromPath(file.path);
				if (month) this.emit(month);
			}),
		);
		plugin.registerEvent(
			this.vault.on("delete", (file) => {
				const month = this.monthFromPath(file.path);
				if (month) this.emit(month);
			}),
		);
	}

	private commitsDir(): string {
		return `${this.plugin.settings.projectRoot}/Commits`;
	}

	private filePath(month: string): string {
		return `${this.commitsDir()}/${month}.md`;
	}

	private monthFromPath(path: string): string | null {
		if (!path.startsWith(this.commitsDir() + "/") || !path.endsWith(".md")) return null;
		const name = path.split("/").pop()!.replace(".md", "");
		return /^\d{4}-\d{2}$/.test(name) ? name : null;
	}

	async listByTask(taskId: string): Promise<CommitEntry[]> {
		const files = this.vault.getFiles().filter((f) => this.monthFromPath(f.path) !== null);
		const batches = await Promise.all(files.map((f) => this.parseFile(f)));
		return batches
			.filter((b): b is CommitBatch => b !== null)
			.flatMap((b) => b.commits)
			.filter((c) => c.taskId === taskId);
	}

	async listByMonth(month: string): Promise<CommitEntry[]> {
		const batch = await this.readBatch(month);
		return batch?.commits ?? [];
	}

	async upsertBatch(commits: CommitEntry[]): Promise<void> {
		if (commits.length === 0) return;

		// date 기준 월별 그룹핑
		const byMonth = new Map<string, CommitEntry[]>();
		for (const commit of commits) {
			const month = commit.date.slice(0, 7);
			if (!byMonth.has(month)) byMonth.set(month, []);
			byMonth.get(month)!.push(commit);
		}

		for (const [month, newCommits] of byMonth) {
			const existing = await this.readBatch(month);
			const now = new Date().toISOString();

			let merged: CommitEntry[];
			if (existing) {
				merged = [...existing.commits];
				for (const c of newCommits) {
					const idx = merged.findIndex((e) => e.sha === c.sha);
					if (idx >= 0) { merged[idx] = c; } else { merged.push(c); }
				}
			} else {
				merged = newCommits;
			}

			const batch: CommitBatch = withUpdatedMeta(
				existing ?? {
					version: 1 as const,
					type: "commit-batch" as const,
					id: `commits-${month}`,
					month,
					syncedAt: now,
					commits: [],
					createdAt: now,
					updatedAt: now,
				},
			);
			const next: CommitBatch = { ...batch, commits: merged, syncedAt: now };
			const md = stringifyFrontmatter(next as unknown as Record<string, unknown>, "");
			await this.writeFile(this.filePath(month), md);
			this.emit(month);
		}
	}

	async deleteByMonth(month: string): Promise<void> {
		const file = this.vault.getAbstractFileByPath(this.filePath(month)) as TFile | null;
		if (file) await this.vault.delete(file);
	}

	watch(callback: (month: string) => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	// ─── internals ───

	private async readBatch(month: string): Promise<CommitBatch | null> {
		const file = this.vault.getAbstractFileByPath(this.filePath(month)) as TFile | null;
		if (!file) return null;
		return this.parseFile(file);
	}

	private async parseFile(file: TFile): Promise<CommitBatch | null> {
		try {
			const raw = await this.vault.read(file);
			const { meta } = parseFrontmatter<Record<string, unknown>>(raw);
			const result = CommitBatchV1.safeParse(meta);
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

	private async writeFile(path: string, md: string): Promise<void> {
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		if (file) {
			await this.vault.modify(file, md);
		} else {
			const dir = this.commitsDir();
			if (!this.vault.getAbstractFileByPath(dir)) {
				await this.vault.createFolder(dir);
			}
			await this.vault.create(path, md);
		}
	}

	private emit(month: string): void {
		for (const listener of this.listeners) {
			try { listener(month); } catch (err) {
				console.error("[Pharos] CommitRepository listener error:", err);
			}
		}
	}
}
