/**
 * SettingsRoadmapRepository — settings(data.json) 기반 RoadmapRepository 구현.
 *
 * 1단계 구현체. 나중에 VaultRoadmapRepository 또는 HocuspocusRoadmapRepository로
 * 교체 시 main.ts 한 줄만 바꾸면 됨.
 */

import type { PharosPluginLike } from "../../../app/settings";
import type { Disposable } from "../../../shared/repo/types";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { Roadmap } from "../domain/roadmapSchema";
import type { RoadmapRepository } from "./roadmapRepository";

export class SettingsRoadmapRepository implements RoadmapRepository {
	private listeners = new Set<(kind: "planning" | "development") => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		plugin.registerEvent(
			plugin.app.workspace.on("pharos:state-changed" as never, () => {
				this.emit("planning");
				this.emit("development");
			}),
		);
	}

	async getPlanning(): Promise<Roadmap | null> {
		return (this.plugin.settings.roadmaps ?? {})["planning"] ?? null;
	}

	async getDevelopment(): Promise<Roadmap | null> {
		return (this.plugin.settings.roadmaps ?? {})["development"] ?? null;
	}

	async savePlanning(roadmap: Roadmap): Promise<void> {
		const next = withUpdatedMeta(roadmap);
		this.plugin.settings.roadmaps = {
			...(this.plugin.settings.roadmaps ?? {}),
			planning: next,
		};
		await this.plugin.saveSettings();
		this.emit("planning");
	}

	async saveDevelopment(roadmap: Roadmap): Promise<void> {
		const next = withUpdatedMeta(roadmap);
		this.plugin.settings.roadmaps = {
			...(this.plugin.settings.roadmaps ?? {}),
			development: next,
		};
		await this.plugin.saveSettings();
		this.emit("development");
	}

	async deleteDevelopment(): Promise<void> {
		const roadmaps = { ...(this.plugin.settings.roadmaps ?? {}) };
		delete roadmaps["development"];
		this.plugin.settings.roadmaps = roadmaps;
		await this.plugin.saveSettings();
		this.emit("development");
	}

	watch(callback: (kind: "planning" | "development") => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	private emit(kind: "planning" | "development"): void {
		for (const listener of this.listeners) {
			try {
				listener(kind);
			} catch (err) {
				console.error("[Pharos] RoadmapRepository listener error:", err);
			}
		}
	}
}
