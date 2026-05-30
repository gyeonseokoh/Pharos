/**
 * VaultProjectRepository — Vault .md 기반 ProjectRepository 구현.
 *
 * 2단계 구현체. `{projectRoot}/project.md` 단일 파일에 frontmatter로 저장.
 * 경석 sync 모듈이 vault.modify 이벤트를 감지해 Hocuspocus로 broadcast.
 *
 * 교체 방법: main.ts 에서
 *   new SettingsProjectRepository(this) → new VaultProjectRepository(this)
 */

import type { TFile, Vault } from "obsidian";
import { Notice } from "obsidian";
import { parseFrontmatter, stringifyFrontmatter } from "../../../shared/repo/frontmatter";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { Disposable } from "../../../shared/repo/types";
import { ProjectV1 } from "../domain/projectSchema";
import type { Project } from "../domain/projectSchema";
import type { ProjectRepository } from "./projectRepository";
import type { PharosPluginLike } from "../../../app/settings";

export class VaultProjectRepository implements ProjectRepository {
	private readonly vault: Vault;
	private readonly listeners = new Set<(project: Project | null) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		this.vault = plugin.app.vault;

		// Vault .md 변경 감지 → 리스너 알림
		plugin.registerEvent(
			this.vault.on("modify", (file) => {
				if (file.path === this.filePath()) {
					void this.notify();
				}
			}),
		);
		plugin.registerEvent(
			this.vault.on("delete", (file) => {
				if (file.path === this.filePath()) {
					for (const listener of this.listeners) {
						try { listener(null); } catch {}
					}
				}
			}),
		);
	}

	private filePath(): string {
		return `${this.plugin.settings.projectRoot}/project.md`;
	}

	async get(): Promise<Project | null> {
		const file = this.vault.getAbstractFileByPath(this.filePath()) as TFile | null;
		if (!file) return null;

		const raw = await this.vault.read(file);
		const { meta } = parseFrontmatter<Record<string, unknown>>(raw);

		const result = ProjectV1.safeParse(meta);
		if (!result.success) {
			console.error("[Pharos] project.md 파싱 실패:", result.error.flatten());
			new Notice("[Pharos] project.md 형식이 잘못됐습니다. 콘솔을 확인하세요.");
			return null;
		}
		return result.data;
	}

	async save(project: Project): Promise<void> {
		const next = withUpdatedMeta(project);
		const { body } = await this.readRaw();
		const md = stringifyFrontmatter(next as Record<string, unknown>, body);

		await this.writeFile(this.filePath(), md);
	}

	async delete(): Promise<void> {
		const file = this.vault.getAbstractFileByPath(this.filePath()) as TFile | null;
		if (file) await this.vault.delete(file);
	}

	watch(callback: (project: Project | null) => void): Disposable {
		this.listeners.add(callback);
		void this.get().then((p) => callback(p));
		return { dispose: () => this.listeners.delete(callback) };
	}

	// ─── internals ───

	private async readRaw(): Promise<{ body: string }> {
		const file = this.vault.getAbstractFileByPath(this.filePath()) as TFile | null;
		if (!file) return { body: "" };
		const raw = await this.vault.read(file);
		const { body } = parseFrontmatter(raw);
		return { body };
	}

	private async writeFile(path: string, md: string): Promise<void> {
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		if (file) {
			await this.vault.modify(file, md);
		} else {
			// 상위 폴더 없으면 자동 생성
			const dir = path.substring(0, path.lastIndexOf("/"));
			if (dir && !this.vault.getAbstractFileByPath(dir)) {
				await this.vault.createFolder(dir);
			}
			await this.vault.create(path, md);
		}
	}

	private async notify(): Promise<void> {
		const current = await this.get();
		for (const listener of this.listeners) {
			try { listener(current); } catch (err) {
				console.error("[Pharos] ProjectRepository listener error:", err);
			}
		}
	}
}
