/**
 * SettingsTaskRepository — settings(data.json) 기반 TaskRepository 구현.
 *
 * 1단계 구현체. 나중에 VaultTaskRepository 또는 HocuspocusTaskRepository로
 * 교체 시 main.ts 한 줄만 바꾸면 됨.
 */

import type { PharosPluginLike } from "../../../app/settings";
import type { ChangeEvent, Disposable } from "../../../shared/repo/types";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type { ChecklistItem, Task, TaskStatus } from "../domain/taskSchema";
import type { ChecklistRepository, LinkedCommit, TaskRepository } from "./taskRepository";

export class SettingsTaskRepository implements TaskRepository {
	private listeners = new Set<(event: ChangeEvent<Task>) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		plugin.registerEvent(
			plugin.app.workspace.on("pharos:state-changed" as never, () => {
				void this.notifyAll();
			}),
		);
	}

	async list(): Promise<Task[]> {
		return this.plugin.settings.tasks ?? [];
	}

	async getById(id: string): Promise<Task | null> {
		return (this.plugin.settings.tasks ?? []).find((t) => t.id === id) ?? null;
	}

	async save(task: Task): Promise<void> {
		const next = withUpdatedMeta(task);
		const tasks = [...(this.plugin.settings.tasks ?? [])];
		const idx = tasks.findIndex((t) => t.id === next.id);

		if (idx >= 0) {
			const before = tasks[idx];
			tasks[idx] = next;
			this.plugin.settings.tasks = tasks;
			await this.plugin.saveSettings();
			this.emit({ kind: "updated", entity: next, before });
		} else {
			tasks.push(next);
			this.plugin.settings.tasks = tasks;
			await this.plugin.saveSettings();
			this.emit({ kind: "created", entity: next });
		}
	}

	async delete(id: string): Promise<void> {
		this.plugin.settings.tasks = (this.plugin.settings.tasks ?? []).filter(
			(t) => t.id !== id,
		);
		await this.plugin.saveSettings();
		this.emit({ kind: "deleted", id });
	}

	async listByPhase(phaseId: string): Promise<Task[]> {
		return (this.plugin.settings.tasks ?? []).filter((t) => t.phaseId === phaseId);
	}

	async listByAssignee(memberId: string): Promise<Task[]> {
		return (this.plugin.settings.tasks ?? []).filter(
			(t) => t.assigneeId === memberId,
		);
	}

	async listByStatus(status: TaskStatus): Promise<Task[]> {
		return (this.plugin.settings.tasks ?? []).filter((t) => t.status === status);
	}

	async setUserCheck(taskId: string, checked: boolean): Promise<void> {
		const task = await this.getById(taskId);
		if (!task) return;
		await this.save({ ...task, userChecked: checked });
	}

	async appendCommit(taskId: string, commit: LinkedCommit): Promise<void> {
		const tasks = [...(this.plugin.settings.tasks ?? [])];
		const idx = tasks.findIndex((t) => t.id === taskId);
		if (idx < 0) return;
		const task = tasks[idx];
		tasks[idx] = {
			...task,
			updatedAt: new Date().toISOString(),
		};
		this.plugin.settings.tasks = tasks;
		await this.plugin.saveSettings();
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

	private emit(event: ChangeEvent<Task>): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (err) {
				console.error("[Pharos] TaskRepository listener error:", err);
			}
		}
	}

	private async notifyAll(): Promise<void> {
		const tasks = await this.list();
		for (const task of tasks) {
			this.emit({ kind: "updated", entity: task, before: task });
		}
	}
}

export class SettingsChecklistRepository implements ChecklistRepository {
	private listeners = new Set<(event: ChangeEvent<ChecklistItem>) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		plugin.registerEvent(
			plugin.app.workspace.on("pharos:state-changed" as never, () => {}),
		);
	}

	async listByTask(taskId: string): Promise<ChecklistItem[]> {
		return (this.plugin.settings.checklistItems ?? []).filter(
			(c) => c.taskId === taskId,
		);
	}

	async save(item: ChecklistItem): Promise<void> {
		const next = withUpdatedMeta(item);
		const items = [...(this.plugin.settings.checklistItems ?? [])];
		const idx = items.findIndex((c) => c.id === next.id);

		if (idx >= 0) {
			const before = items[idx];
			items[idx] = next;
			this.plugin.settings.checklistItems = items;
			await this.plugin.saveSettings();
			this.emit({ kind: "updated", entity: next, before });
		} else {
			items.push(next);
			this.plugin.settings.checklistItems = items;
			await this.plugin.saveSettings();
			this.emit({ kind: "created", entity: next });
		}
	}

	async delete(id: string): Promise<void> {
		this.plugin.settings.checklistItems = (
			this.plugin.settings.checklistItems ?? []
		).filter((c) => c.id !== id);
		await this.plugin.saveSettings();
		this.emit({ kind: "deleted", id });
	}

	watch(callback: (event: ChangeEvent<ChecklistItem>) => void): Disposable {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	}

	private emit(event: ChangeEvent<ChecklistItem>): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (err) {
				console.error("[Pharos] ChecklistRepository listener error:", err);
			}
		}
	}
}
