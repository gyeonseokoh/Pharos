/**
 * VaultAvailabilityRepository — Vault .md 기반 AvailabilityRepository 구현.
 *
 * 2단계 구현체. 설계 문서 4.6절 기준:
 *   `{projectRoot}/Availability/{weekStart}.md` (주차별 1파일)
 *
 * 교체 방법: main.ts 에서
 *   new SettingsAvailabilityRepository(this) → new VaultAvailabilityRepository(this)
 */

import type { TFile, Vault } from "obsidian";
import { parseFrontmatter, stringifyFrontmatter } from "../../../shared/repo/frontmatter";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { Disposable } from "../../../shared/repo/types";
import { AvailabilityV1 } from "../domain/availabilitySchema";
import type { Availability, AvailabilitySlot } from "../domain/availabilitySchema";
import type { AvailabilityRepository } from "./availabilityRepository";
import type { PharosPluginLike } from "../../../app/settings";

export class VaultAvailabilityRepository implements AvailabilityRepository {
	private readonly vault: Vault;
	private readonly listeners = new Set<(weekStart: string) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		this.vault = plugin.app.vault;

		plugin.registerEvent(
			this.vault.on("modify", (file) => {
				const weekStart = this.weekStartFromPath(file.path);
				if (weekStart) this.emit(weekStart);
			}),
		);
		plugin.registerEvent(
			this.vault.on("delete", (file) => {
				const weekStart = this.weekStartFromPath(file.path);
				if (weekStart) this.emit(weekStart);
			}),
		);
	}

	private availDir(): string {
		return `${this.plugin.settings.projectRoot}/Availability`;
	}

	// 설계 문서 §4.6: 파일명은 ISO 8601 주차 형식 (YYYY-W##.md)
	private filePath(weekStart: string): string {
		return `${this.availDir()}/${toISOWeekString(weekStart)}.md`;
	}

	// 파일 경로에서 weekStart(YYYY-MM-DD) 복원.
	// 파일명: YYYY-W## → 해당 주 월요일 날짜로 변환.
	private weekStartFromPath(path: string): string | null {
		if (!path.startsWith(this.availDir() + "/") || !path.endsWith(".md")) return null;
		const name = path.split("/").pop()!.replace(".md", "");
		return isoWeekStringToWeekStart(name);
	}

	async getByWeek(weekStart: string): Promise<Availability | null> {
		const file = this.vault.getAbstractFileByPath(this.filePath(weekStart)) as TFile | null;
		if (!file) return null;
		return this.parseFile(file);
	}

	async listByMember(memberId: string): Promise<Availability[]> {
		const files = this.vault.getFiles().filter((f) =>
			f.path.startsWith(this.availDir() + "/") && f.path.endsWith(".md"),
		);
		const results = await Promise.all(files.map((f) => this.parseFile(f)));
		return results
			.filter((a): a is Availability => a !== null)
			.filter((a) => a.slots.some((s) => s.memberId === memberId));
	}

	async saveSlots(weekStart: string, slots: AvailabilitySlot[]): Promise<void> {
		const now = new Date().toISOString();
		const existing = await this.getByWeek(weekStart);
		// 설계 문서 §4.6: id = "avail-YYYY-W##" (ISO 주차 형식)
		const isoWeek = toISOWeekString(weekStart);
		const avail: Availability = withUpdatedMeta(
			existing ?? {
				version: 1 as const,
				type: "availability" as const,
				id: `avail-${isoWeek}`,
				weekStart,
				slots: [],
				createdAt: now,
				updatedAt: now,
			},
		);
		const next: Availability = { ...avail, slots };
		const md = stringifyFrontmatter(next as unknown as Record<string, unknown>, "");
		await this.writeFile(this.filePath(weekStart), md);
	}

	async deleteByWeek(weekStart: string): Promise<void> {
		const file = this.vault.getAbstractFileByPath(this.filePath(weekStart)) as TFile | null;
		if (file) await this.vault.delete(file);
	}

	watch(callback: (weekStart: string) => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	// ─── internals ───

	private async parseFile(file: TFile): Promise<Availability | null> {
		try {
			const raw = await this.vault.read(file);
			const { meta } = parseFrontmatter<Record<string, unknown>>(raw);
			const result = AvailabilityV1.safeParse(meta);
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
			const dir = this.availDir();
			if (!this.vault.getAbstractFileByPath(dir)) {
				await this.vault.createFolder(dir);
			}
			await this.vault.create(path, md);
		}
	}

	private emit(weekStart: string): void {
		for (const listener of this.listeners) {
			try { listener(weekStart); } catch (err) {
				console.error("[Pharos] AvailabilityRepository listener error:", err);
			}
		}
	}
}

// ─── ISO 8601 주차 변환 유틸리티 ──────────────────────────────────────────────

/**
 * 월요일 날짜(YYYY-MM-DD) → ISO 8601 주차 문자열(YYYY-W##).
 * 설계 문서 §4.6 — Availability 파일명·id 컨벤션.
 *
 * ISO 8601 규칙: 목요일이 포함된 연도·주차가 그 주의 기준.
 */
function toISOWeekString(weekStart: string): string {
	const monday = new Date(weekStart + "T00:00:00");
	const thursday = new Date(monday.getTime() + 3 * 86_400_000);
	const year = thursday.getFullYear();
	const jan1 = new Date(year, 0, 1);
	const daysDiff = Math.round((thursday.getTime() - jan1.getTime()) / 86_400_000);
	const weekNum = Math.ceil((daysDiff + jan1.getDay() + 1) / 7);
	return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * ISO 8601 주차 문자열(YYYY-W##) → 해당 주 월요일 날짜(YYYY-MM-DD).
 * vault.on('modify') 이벤트 경로에서 weekStart를 복원할 때 사용.
 */
function isoWeekStringToWeekStart(isoWeek: string): string | null {
	const m = isoWeek.match(/^(\d{4})-W(\d{2})$/);
	if (!m) return null;
	const year = parseInt(m[1]!);
	const week = parseInt(m[2]!);
	// ISO 8601: 1월 4일은 반드시 1주차에 포함됨
	const jan4 = new Date(year, 0, 4);
	const jan4Day = jan4.getDay() || 7; // 1=Mon … 7=Sun
	const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86_400_000);
	const targetMonday = new Date(week1Monday.getTime() + (week - 1) * 7 * 86_400_000);
	return targetMonday.toISOString().slice(0, 10);
}
