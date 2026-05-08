/**
 * VaultMeetingRepository — Vault .md 기반 MeetingRepository 구현.
 *
 * 2단계 구현체. 설계 문서 4.2절 기준:
 *   `{projectRoot}/Meetings/{date}_{slug}.md` (회의 1건 = 1파일)
 *
 * 회의록 본문(minutes.content)은 .md 파일 body에, 나머지 메타는 frontmatter에 저장.
 * 경석 sync 모듈이 vault.modify 이벤트를 감지해 Hocuspocus로 broadcast.
 *
 * 교체 방법: main.ts 에서
 *   new SettingsMeetingRepository(this) → new VaultMeetingRepository(this)
 */

import type { TFile, Vault } from "obsidian";
import { Notice } from "obsidian";
import { parseFrontmatter, stringifyFrontmatter } from "../../../shared/repo/frontmatter";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { ChangeEvent, Disposable } from "../../../shared/repo/types";
import { MeetingV1 } from "../domain/meetingSchema";
import type {
	Meeting,
	MeetingCategory,
	MeetingFilter,
	MeetingStatus,
} from "../domain/meetingSchema";
import type { MeetingRepository } from "./meetingRepository";
import type { PharosPluginLike } from "../../../app/settings";

export class VaultMeetingRepository implements MeetingRepository {
	private readonly vault: Vault;
	private readonly listeners = new Set<(event: ChangeEvent<Meeting>) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		this.vault = plugin.app.vault;

		plugin.registerEvent(
			this.vault.on("create", (file) => {
				if (this.isMeetingFile(file.path)) void this.onFileChanged(file.path, "created");
			}),
		);
		plugin.registerEvent(
			this.vault.on("modify", (file) => {
				if (this.isMeetingFile(file.path)) void this.onFileChanged(file.path, "updated");
			}),
		);
		plugin.registerEvent(
			this.vault.on("delete", (file) => {
				if (this.isMeetingFile(file.path)) {
					// 삭제된 파일의 id를 미리 알 수 없어 generic "deleted" 통지 불가
					// 전체 목록 갱신 트리거
					this.emitGeneric();
				}
			}),
		);
	}

	private meetingsDir(): string {
		return `${this.plugin.settings.projectRoot}/Meetings`;
	}

	private isMeetingFile(path: string): boolean {
		return path.startsWith(this.meetingsDir() + "/") && path.endsWith(".md");
	}

	/** 회의 → 파일명 계산. 설계 문서 4.2절: `{date}_{slug}.md` */
	private computeFilePath(meeting: Meeting): string {
		const slug = meeting.title
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^\w가-힣-]/g, "") // 한글 + 알파벳 + 숫자 + 하이픈 허용
			.slice(0, 40);
		return `${this.meetingsDir()}/${meeting.date}_${slug}.md`;
	}

	async list(filter?: MeetingFilter): Promise<Meeting[]> {
		const files = this.vault.getFiles().filter((f) => this.isMeetingFile(f.path));
		const results = await Promise.all(files.map((f) => this.parseFile(f)));
		const all = results.filter((m): m is Meeting => m !== null);
		return this.applyFilter(all, filter);
	}

	async getById(id: string): Promise<Meeting | null> {
		const all = await this.list();
		return all.find((m) => m.id === id) ?? null;
	}

	async save(meeting: Meeting): Promise<void> {
		const next = withUpdatedMeta(meeting);
		const path = this.computeFilePath(next);

		// 회의록 본문은 .md body에, 나머지는 frontmatter에 저장
		const { minutes, ...meta } = next;
		const frontmatter = {
			...meta,
			// minutes.content는 body로 분리, 나머지 minutes 메타는 frontmatter에 유지
			minutes: minutes
				? { authorName: minutes.authorName, writtenAt: minutes.writtenAt }
				: null,
		};
		const body = minutes?.content ?? "";

		const md = stringifyFrontmatter(frontmatter as unknown as Record<string, unknown>, body);
		await this.writeFile(path, md);
	}

	async delete(id: string): Promise<void> {
		const meeting = await this.getById(id);
		if (!meeting) return;
		const path = this.computeFilePath(meeting);
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		if (file) await this.vault.delete(file);
	}

	async listMeetingsWithoutMinutes(): Promise<Meeting[]> {
		return (await this.list()).filter((m) => m.minutes === null);
	}

	async listByCategory(category: MeetingCategory): Promise<Meeting[]> {
		return (await this.list()).filter((m) =>
			m.analysis?.categories?.includes(category),
		);
	}

	async listByStatus(status: MeetingStatus): Promise<Meeting[]> {
		return this.list({ status });
	}

	watch(callback: (event: ChangeEvent<Meeting>) => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	// ─── internals ───

	private async parseFile(file: TFile): Promise<Meeting | null> {
		try {
			const raw = await this.vault.read(file);
			const { meta, body } = parseFrontmatter<Record<string, unknown>>(raw);

			// minutes.content는 body에서 복원
			const minutesMeta = meta.minutes as
				| { authorName: string; writtenAt: string }
				| null
				| undefined;
			const fullMeta = {
				...meta,
				minutes: minutesMeta
					? { ...minutesMeta, content: body }
					: null,
			};

			const result = MeetingV1.safeParse(fullMeta);
			if (!result.success) {
				console.error(`[Pharos] ${file.path} 파싱 실패:`, result.error.flatten());
				new Notice(`[Pharos] ${file.name} 형식이 잘못됐습니다. 해당 회의를 건너뜁니다.`);
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
		const meeting = await this.parseFile(file);
		if (!meeting) return;
		if (kind === "created") {
			this.emitEvent({ kind: "created", entity: meeting });
		} else {
			this.emitEvent({ kind: "updated", entity: meeting, before: meeting });
		}
	}

	private async writeFile(path: string, md: string): Promise<void> {
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		if (file) {
			await this.vault.modify(file, md);
		} else {
			const dir = this.meetingsDir();
			if (!this.vault.getAbstractFileByPath(dir)) {
				await this.vault.createFolder(dir);
			}
			await this.vault.create(path, md);
		}
	}

	private applyFilter(all: Meeting[], filter?: MeetingFilter): Meeting[] {
		if (!filter) return all;
		return all.filter((m) => {
			if (filter.status && m.status !== filter.status) return false;
			if (filter.meetingType && m.meetingType !== filter.meetingType) return false;
			if (filter.category && !m.analysis?.categories?.includes(filter.category)) return false;
			if (filter.dateFrom && m.date < filter.dateFrom) return false;
			if (filter.dateTo && m.date > filter.dateTo) return false;
			return true;
		});
	}

	private emitEvent(event: ChangeEvent<Meeting>): void {
		for (const listener of this.listeners) {
			try { listener(event); } catch (err) {
				console.error("[Pharos] MeetingRepository listener error:", err);
			}
		}
	}

	/** 삭제 등 id 특정 불가 시 전체 목록 "updated" 통지 */
	private emitGeneric(): void {
		void this.list().then((all) => {
			for (const m of all) {
				this.emitEvent({ kind: "updated", entity: m, before: m });
			}
		});
	}
}
