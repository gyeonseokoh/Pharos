/**
 * VaultTaskRepository — Vault .md 기반 TaskRepository 구현.
 *
 * 2단계 구현체. `{projectRoot}/Tasks/TASK-NNN.md` 파일로 저장.
 * 설계 문서 4.4절 기준: Task 1건 = 파일 1개.
 *
 * nextId(): settings.taskNextId 카운터는 2단계에서도 유지.
 *   (단순 증가 카운터라 .md 파일로 분리할 실익이 없음)
 *
 * 교체 방법: main.ts 에서
 *   new SettingsTaskRepository(this) → new VaultTaskRepository(this)
 */

import type { TFile, Vault } from "obsidian";
import { Notice } from "obsidian";
import { parseFrontmatter, stringifyFrontmatter } from "../../../shared/repo/frontmatter";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { ChangeEvent, Disposable } from "../../../shared/repo/types";
import { TaskV1 } from "../domain/taskSchema";
import type { Task, TaskStatus } from "../domain/taskSchema";
import type { LinkedCommit, TaskRepository } from "./taskRepository";
import type { PharosPluginLike } from "../../../app/settings";

export class VaultTaskRepository implements TaskRepository {
	private readonly vault: Vault;
	private readonly listeners = new Set<(event: ChangeEvent<Task>) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		this.vault = plugin.app.vault;

		plugin.registerEvent(
			this.vault.on("create", (file) => {
				if (this.isTaskFile(file.path)) void this.onFileChanged(file.path, "created");
			}),
		);
		plugin.registerEvent(
			this.vault.on("modify", (file) => {
				if (this.isTaskFile(file.path)) void this.onFileChanged(file.path, "updated");
			}),
		);
		plugin.registerEvent(
			this.vault.on("delete", (file) => {
				if (this.isTaskFile(file.path)) {
					const id = this.idFromPath(file.path);
					if (id) this.emit({ kind: "deleted", id });
				}
			}),
		);
	}

	private tasksDir(): string {
		return `${this.plugin.settings.projectRoot}/Tasks`;
	}

	private filePath(id: string): string {
		return `${this.tasksDir()}/${id}.md`;
	}

	private isTaskFile(path: string): boolean {
		return path.startsWith(this.tasksDir() + "/") && path.endsWith(".md");
	}

	private idFromPath(path: string): string | null {
		const name = path.split("/").pop()?.replace(".md", "");
		return name?.match(/^TASK-\d+$/) ? name : null;
	}

	async list(): Promise<Task[]> {
		const dir = this.vault.getAbstractFileByPath(this.tasksDir());
		if (!dir) return [];

		const files = this.vault.getFiles().filter((f) => this.isTaskFile(f.path));
		const results = await Promise.all(files.map((f) => this.parseFile(f)));
		return results.filter((t): t is Task => t !== null);
	}

	async getById(id: string): Promise<Task | null> {
		const file = this.vault.getAbstractFileByPath(this.filePath(id)) as TFile | null;
		if (!file) return null;
		return this.parseFile(file);
	}

	async save(task: Task): Promise<void> {
		const next = withUpdatedMeta(task);
		// 본문(노트 영역)은 기존 파일에서 보존
		const existing = this.vault.getAbstractFileByPath(this.filePath(next.id)) as TFile | null;
		let body = "";
		if (existing) {
			const raw = await this.vault.read(existing);
			body = parseFrontmatter(raw).body;
		}
		const md = stringifyFrontmatter(next as unknown as Record<string, unknown>, body);
		await this.writeFile(this.filePath(next.id), md);
	}

	async delete(id: string): Promise<void> {
		const file = this.vault.getAbstractFileByPath(this.filePath(id)) as TFile | null;
		if (file) await this.vault.delete(file);
	}

	async listByPhase(phaseId: string): Promise<Task[]> {
		return (await this.list()).filter((t) => t.phaseId === phaseId);
	}

	async listByAssignee(memberId: string): Promise<Task[]> {
		return (await this.list()).filter((t) => t.assignee?.id === memberId);
	}

	async listByStatus(status: TaskStatus): Promise<Task[]> {
		return (await this.list()).filter((t) => t.status === status);
	}

	async setUserCheck(taskId: string, checked: boolean): Promise<void> {
		const task = await this.getById(taskId);
		if (!task) return;
		await this.save({ ...task, userChecked: checked });
	}

	async appendCommit(taskId: string, commit: LinkedCommit): Promise<void> {
		const task = await this.getById(taskId);
		if (!task) return;
		await this.save({ ...task, linkedCommits: [...(task.linkedCommits ?? []), commit] });
	}

	async nextId(): Promise<string> {
		const n = this.plugin.settings.taskNextId ?? 1;
		this.plugin.settings.taskNextId = n + 1;
		await this.plugin.saveSettings();
		return `TASK-${n}`;
	}

	watch(callback: (event: ChangeEvent<Task>) => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	// ─── internals ───

	private async parseFile(file: TFile): Promise<Task | null> {
		try {
			const raw = await this.vault.read(file);
			const { meta } = parseFrontmatter<Record<string, unknown>>(raw);
			const result = TaskV1.safeParse(meta);
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

	private async onFileChanged(path: string, kind: "created" | "updated"): Promise<void> {
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		if (!file) return;
		const task = await this.parseFile(file);
		if (!task) return;
		if (kind === "created") {
			this.emit({ kind: "created", entity: task });
		} else {
			this.emit({ kind: "updated", entity: task, before: task });
		}
	}

	private async writeFile(path: string, md: string): Promise<void> {
		const file = this.vault.getAbstractFileByPath(path) as TFile | null;
		if (file) {
			await this.vault.modify(file, md);
		} else {
			const dir = path.substring(0, path.lastIndexOf("/"));
			if (dir && !this.vault.getAbstractFileByPath(dir)) {
				await this.vault.createFolder(dir);
			}
			await this.vault.create(path, md);
		}
	}

	private emit(event: ChangeEvent<Task>): void {
		for (const listener of this.listeners) {
			try { listener(event); } catch (err) {
				console.error("[Pharos] TaskRepository listener error:", err);
			}
		}
	}
}
