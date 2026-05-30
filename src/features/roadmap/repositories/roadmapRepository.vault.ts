/**
 * VaultRoadmapRepository — Vault .md 기반 RoadmapRepository 구현.
 *
 * 2단계 구현체. 설계 문서 4.3절 기준:
 *   - `{projectRoot}/Roadmap/planning.md`
 *   - `{projectRoot}/Roadmap/development.md`
 *
 * 교체 방법: main.ts 에서
 *   new SettingsRoadmapRepository(this) → new VaultRoadmapRepository(this)
 */

import type { TFile, Vault } from "obsidian";
import { parseFrontmatter, stringifyFrontmatter } from "../../../shared/repo/frontmatter";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { Disposable } from "../../../shared/repo/types";
import { RoadmapV1 } from "../domain/roadmapSchema";
import type { Roadmap } from "../domain/roadmapSchema";
import type { RoadmapRepository } from "./roadmapRepository";
import type { PharosPluginLike } from "../../../app/settings";

export class VaultRoadmapRepository implements RoadmapRepository {
	private readonly vault: Vault;
	private readonly listeners = new Set<(kind: "planning" | "development") => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		this.vault = plugin.app.vault;

		plugin.registerEvent(
			this.vault.on("modify", (file) => {
				if (file.path === this.planningPath()) this.emit("planning");
				else if (file.path === this.developmentPath()) this.emit("development");
			}),
		);
		plugin.registerEvent(
			this.vault.on("delete", (file) => {
				if (file.path === this.planningPath()) this.emit("planning");
				else if (file.path === this.developmentPath()) this.emit("development");
			}),
		);
	}

	private roadmapDir(): string {
		return `${this.plugin.settings.projectRoot}/Roadmap`;
	}

	private planningPath(): string {
		return `${this.roadmapDir()}/planning.md`;
	}

	private developmentPath(): string {
		return `${this.roadmapDir()}/development.md`;
	}

	async getPlanning(): Promise<Roadmap | null> {
		return this.readRoadmap(this.planningPath());
	}

	async getDevelopment(): Promise<Roadmap | null> {
		return this.readRoadmap(this.developmentPath());
	}

	async savePlanning(roadmap: Roadmap): Promise<void> {
		await this.writeRoadmap(this.planningPath(), roadmap);
	}

	async saveDevelopment(roadmap: Roadmap): Promise<void> {
		await this.writeRoadmap(this.developmentPath(), roadmap);
	}

	async deleteDevelopment(): Promise<void> {
		const file = this.vault.getAbstractFileByPath(this.developmentPath()) as TFile | null;
		if (file) await this.vault.delete(file);
	}

	watch(callback: (kind: "planning" | "development") => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	// ─── internals ───

	private async readRoadmap(path: string): Promise<Roadmap | null> {
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		if (!file) return null;
		try {
			const raw = await this.vault.read(file);
			const { meta } = parseFrontmatter<Record<string, unknown>>(raw);
			const result = RoadmapV1.safeParse(meta);
			if (!result.success) {
				console.error(`[Pharos] ${path} 파싱 실패:`, result.error.flatten());
				return null;
			}
			return result.data;
		} catch (err) {
			console.error(`[Pharos] ${path} 읽기 실패:`, err);
			return null;
		}
	}

	private async writeRoadmap(path: string, roadmap: Roadmap): Promise<void> {
		const next = withUpdatedMeta(roadmap);
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		let body = "";
		if (file) {
			const raw = await this.vault.read(file);
			body = parseFrontmatter(raw).body;
		}
		const md = stringifyFrontmatter(next as unknown as Record<string, unknown>, body);
		if (file) {
			await this.vault.modify(file, md);
		} else {
			const dir = this.roadmapDir();
			if (!this.vault.getAbstractFileByPath(dir)) {
				await this.vault.createFolder(dir);
			}
			await this.vault.create(path, md);
		}
	}

	private emit(kind: "planning" | "development"): void {
		for (const listener of this.listeners) {
			try { listener(kind); } catch (err) {
				console.error("[Pharos] RoadmapRepository listener error:", err);
			}
		}
	}
}
