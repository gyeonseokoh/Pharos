/**
 * SettingsProjectRepository — settings(data.json) 기반 ProjectRepository 구현.
 *
 * 1단계 구현체. 현재 동작 그대로 유지 (PharosSettings.projectReport + 플래그 + 동기화 ID).
 * 나중에 VaultProjectRepository 만들면 main.ts 한 줄로 교체 가능.
 *
 * settings 의 흩어진 필드들을 Project 엔티티 한 객체로 응집:
 *   - settings.projectReport             → name·description·deadline·fixedMeeting* 등
 *   - settings.planningRoadmapGenerated  → 같은 Project 객체로
 *   - settings.developmentRoadmapGenerated → 같은 Project 객체로
 *   - (workspaceId는 추후 추가 예정)
 */

import type { PharosPluginLike } from "../../../app/settings";
import type { Disposable } from "../../../shared/repo/types";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { Project } from "../domain/projectSchema";
import type { ProjectRepository } from "./projectRepository";

const PROJECT_ID = "proj-pharos";

export class SettingsProjectRepository implements ProjectRepository {
	private listeners = new Set<(project: Project | null) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		// settings 변경 시 (saveSettings 호출 시) 자동 알림
		// plugin.registerEvent 로 등록 → onunload 시 자동 해제
		plugin.registerEvent(
			plugin.app.workspace.on("pharos:state-changed" as never, () => {
				void this.notify();
			}),
		);
	}

	async get(): Promise<Project | null> {
		const s = this.plugin.settings;
		if (!s.projectReport) return null;

		const report = s.projectReport;
		const project: Project = {
			version: 1,
			type: "project",
			id: PROJECT_ID,
			name: report.name,
			description: report.description,
			deadline: report.deadline,
			fixedMeetingMode: report.fixedMeetingMode,
			fixedMeetingDay: report.fixedMeetingDay,
			fixedMeetingTime: report.fixedMeetingTime,
			planningRoadmapGenerated: s.planningRoadmapGenerated,
			developmentRoadmapGenerated: s.developmentRoadmapGenerated,
			workspaceId: "", // settings에 아직 저장 안 함 (다음 phase에서 추가)
			createdAt: report.createdAt,
			updatedAt: report.createdAt, // settings 모델엔 별도 updatedAt 없음
		};
		return project;
	}

	async save(project: Project): Promise<void> {
		const next = withUpdatedMeta(project);

		this.plugin.settings.projectReport = {
			name: next.name,
			description: next.description,
			deadline: next.deadline,
			fixedMeetingMode: next.fixedMeetingMode,
			fixedMeetingDay: next.fixedMeetingDay,
			fixedMeetingTime: next.fixedMeetingTime,
			createdAt: next.createdAt,
		};
		this.plugin.settings.planningRoadmapGenerated = next.planningRoadmapGenerated;
		this.plugin.settings.developmentRoadmapGenerated = next.developmentRoadmapGenerated;

		await this.plugin.saveSettings();
		// saveSettings가 pharos:state-changed 발행 → notify() 자동 트리거
	}

	async delete(): Promise<void> {
		this.plugin.settings.projectReport = null;
		this.plugin.settings.planningRoadmapGenerated = false;
		this.plugin.settings.developmentRoadmapGenerated = false;
		this.plugin.settings.developmentRoadmap = null;
		this.plugin.settings.attachedMinutes = {};
		await this.plugin.saveSettings();
	}

	watch(callback: (project: Project | null) => void): Disposable {
		this.listeners.add(callback);
		// 초기값 즉시 통지
		void this.get().then((p) => callback(p));
		return {
			dispose: () => {
				this.listeners.delete(callback);
			},
		};
	}

	private async notify(): Promise<void> {
		const current = await this.get();
		for (const listener of this.listeners) {
			try {
				listener(current);
			} catch (err) {
				console.error("[Pharos] ProjectRepository listener error:", err);
			}
		}
	}
}
