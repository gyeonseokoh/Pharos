/**
 * SettingsAvailabilityRepository — settings(data.json) 기반 AvailabilityRepository 구현.
 *
 * 1단계 구현체. 나중에 VaultAvailabilityRepository 또는 HocuspocusAvailabilityRepository로
 * 교체 시 main.ts 한 줄만 바꾸면 됨.
 */

import type { PharosPluginLike } from "../../../app/settings";
import type { Disposable } from "../../../shared/repo/types";
import type { Availability, AvailabilitySlot } from "../domain/availabilitySchema";
import type { AvailabilityRepository } from "./availabilityRepository";

export class SettingsAvailabilityRepository implements AvailabilityRepository {
	private listeners = new Set<(weekStart: string) => void>();

	constructor(private readonly plugin: PharosPluginLike) {}

	async getByWeek(weekStart: string): Promise<Availability | null> {
		return (
			(this.plugin.settings.availabilities ?? []).find(
				(a) => a.weekStart === weekStart,
			) ?? null
		);
	}

	async listByMember(memberId: string): Promise<Availability[]> {
		return (this.plugin.settings.availabilities ?? []).filter((a) =>
			a.slots.some((s) => s.memberId === memberId),
		);
	}

	async saveSlots(weekStart: string, slots: AvailabilitySlot[]): Promise<void> {
		const availabilities = [...(this.plugin.settings.availabilities ?? [])];
		const idx = availabilities.findIndex((a) => a.weekStart === weekStart);
		const now = new Date().toISOString();

		const existing = idx >= 0 ? availabilities[idx] : undefined;
		const next: Availability = {
			version: 1,
			type: "availability",
			id: `avail-${weekStart}`,
			weekStart,
			slots,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
		};

		if (idx >= 0) {
			availabilities[idx] = next;
		} else {
			availabilities.push(next);
		}

		this.plugin.settings.availabilities = availabilities;
		await this.plugin.saveSettings();
		this.emit(weekStart);
	}

	async deleteByWeek(weekStart: string): Promise<void> {
		this.plugin.settings.availabilities = (
			this.plugin.settings.availabilities ?? []
		).filter((a) => a.weekStart !== weekStart);
		await this.plugin.saveSettings();
		this.emit(weekStart);
	}

	watch(callback: (weekStart: string) => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	private emit(weekStart: string): void {
		for (const listener of this.listeners) {
			try {
				listener(weekStart);
			} catch (err) {
				console.error("[Pharos] AvailabilityRepository listener error:", err);
			}
		}
	}
}
