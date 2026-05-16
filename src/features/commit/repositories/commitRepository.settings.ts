/**
 * SettingsCommitRepository — settings(data.json) 기반 CommitRepository 구현.
 *
 * 1단계 구현체. 나중에 VaultCommitRepository 또는 HocuspocusCommitRepository로
 * 교체 시 main.ts 한 줄만 바꾸면 됨.
 *
 * 보존 등급 🟢 — 재생성 가능 캐시. 동기화 제외 대상 (경석 sync 필터 처리).
 */

import type { PharosPluginLike } from "../../../app/settings";
import type { Disposable } from "../../../shared/repo/types";
import type { CommitBatch, CommitEntry } from "../domain/commitSchema";
import type { CommitRepository } from "./commitRepository";

export class SettingsCommitRepository implements CommitRepository {
	private listeners = new Set<(month: string) => void>();

	constructor(private readonly plugin: PharosPluginLike) {}

	async listByTask(taskId: string): Promise<CommitEntry[]> {
		return (this.plugin.settings.commitBatches ?? [])
			.flatMap((b) => b.commits)
			.filter((c) => c.taskId === taskId);
	}

	async listByMonth(month: string): Promise<CommitEntry[]> {
		const batch = (this.plugin.settings.commitBatches ?? []).find(
			(b) => b.month === month,
		);
		return batch?.commits ?? [];
	}

	async upsertBatch(commits: CommitEntry[]): Promise<void> {
		if (commits.length === 0) return;

		// 커밋의 date 필드(ISO datetime)에서 월 추출 후 월별로 그룹
		const byMonth = new Map<string, CommitEntry[]>();
		for (const commit of commits) {
			const month = commit.date.slice(0, 7); // "YYYY-MM"
			if (!byMonth.has(month)) byMonth.set(month, []);
			byMonth.get(month)!.push(commit);
		}

		const batches = [...(this.plugin.settings.commitBatches ?? [])];
		const now = new Date().toISOString();
		const changedMonths: string[] = [];

		for (const [month, newCommits] of byMonth) {
			const idx = batches.findIndex((b) => b.month === month);

			const existingBatch = idx >= 0 ? batches[idx] : undefined;
			if (idx >= 0 && existingBatch) {
				// 기존 배치에 병합 — sha 기준 중복 제거 (신규가 기존을 덮어씀)
				const merged = [...existingBatch.commits];
				for (const c of newCommits) {
					const existingIdx = merged.findIndex((e) => e.sha === c.sha);
					if (existingIdx >= 0) {
						merged[existingIdx] = c;
					} else {
						merged.push(c);
					}
				}
				batches[idx] = {
					...existingBatch,
					commits: merged,
					syncedAt: now,
					updatedAt: now,
				};
			} else {
				// 새 배치 생성
				const newBatch: CommitBatch = {
					version: 1,
					type: "commit-batch",
					id: `commits-${month}`,
					month,
					syncedAt: now,
					commits: newCommits,
					createdAt: now,
					updatedAt: now,
				};
				batches.push(newBatch);
			}

			changedMonths.push(month);
		}

		this.plugin.settings.commitBatches = batches;
		await this.plugin.saveSettings();

		for (const month of changedMonths) {
			this.emit(month);
		}
	}

	async deleteByMonth(month: string): Promise<void> {
		this.plugin.settings.commitBatches = (
			this.plugin.settings.commitBatches ?? []
		).filter((b) => b.month !== month);
		await this.plugin.saveSettings();
		this.emit(month);
	}

	watch(callback: (month: string) => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	private emit(month: string): void {
		for (const listener of this.listeners) {
			try {
				listener(month);
			} catch (err) {
				console.error("[Pharos] CommitRepository listener error:", err);
			}
		}
	}
}
