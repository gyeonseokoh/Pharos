/**
 * VaultStore — MVP data persistence layer.
 *
 * Writes all Pharos state to files inside the Obsidian Vault:
 *   - `.pharos/*.json` — internal state (team, tasks, meetings, ...)
 *   - `Dashboard/*.md`, `Meetings/*.md` — user-facing Markdown documents
 *
 * v2 will swap this for a `YjsStore` that talks to Hocuspocus. The `Store`
 * interface is the contract both implementations must satisfy, so feature
 * code should never import the concrete class directly — use the `Store`
 * type from `app/container.ts`.
 */

import type { App, EventRef } from "obsidian";

export interface Store {
	/**
	 * Reads and parses a file.
	 * - `.json` files are parsed as JSON and cast to `T`.
	 * - Any other extension returns the raw string (cast to `T`).
	 *
	 * Returns `null` when the file does not exist.
	 */
	read<T>(path: string): Promise<T | null>;

	/**
	 * Writes a value to a file. Parent directories are created automatically.
	 * - If `data` is a string, it is written verbatim.
	 * - Otherwise, it is serialized to pretty-printed JSON.
	 */
	write<T>(path: string, data: T): Promise<void>;

	/** Appends text to a file, creating it if necessary. */
	append(path: string, text: string): Promise<void>;

	/** Returns paths of files and folders inside `directory`. */
	list(directory: string, pattern?: RegExp): Promise<string[]>;

	/**
	 * Registers a callback that fires whenever the file at `path` changes.
	 * Returns a disposer that unregisters the callback.
	 */
	watch<T>(path: string, cb: (data: T | null) => void): () => void;

	/** Returns `true` if a file or folder exists at `path`. */
	exists(path: string): Promise<boolean>;

	/** Deletes the file at `path`. No-op if the file does not exist. */
	remove(path: string): Promise<void>;
}

/**
 * Obsidian Vault implementation of `Store`. Intended for MVP use.
 *
 * Lifecycle: construct once in `plugin.ts#onload`, call `dispose()` in
 * `onunload` to release the vault event listener.
 */
export class VaultStore implements Store {
	private readonly modifyRef: EventRef;
	private readonly watchers = new Map<string, Set<(data: unknown) => void>>();

	constructor(private readonly app: App) {
		this.modifyRef = this.app.vault.on("modify", (file) => {
			void this.notifyWatchers(file.path);
		});
	}

	dispose(): void {
		this.app.vault.offref(this.modifyRef);
		this.watchers.clear();
	}

	async read<T>(path: string): Promise<T | null> {
		if (!(await this.exists(path))) {
			return null;
		}

		const raw = await this.app.vault.adapter.read(path);

		if (path.endsWith(".json")) {
			try {
				return JSON.parse(raw) as T;
			} catch (err) {
				throw new Error(`Invalid JSON in ${path}: ${(err as Error).message}`);
			}
		}

		return raw as unknown as T;
	}

	async write<T>(path: string, data: T): Promise<void> {
		const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
		await this.ensureParentDir(path);
		await this.app.vault.adapter.write(path, content);
	}

	async append(path: string, text: string): Promise<void> {
		const existing = (await this.read<string>(path)) ?? "";
		await this.write(path, existing + text);
	}

	async list(directory: string, pattern?: RegExp): Promise<string[]> {
		if (!(await this.exists(directory))) {
			return [];
		}
		const result = await this.app.vault.adapter.list(directory);
		const entries = [...result.files, ...result.folders];
		return pattern ? entries.filter((p) => pattern.test(p)) : entries;
	}

	watch<T>(path: string, cb: (data: T | null) => void): () => void {
		if (!this.watchers.has(path)) {
			this.watchers.set(path, new Set());
		}
		const subs = this.watchers.get(path)!;
		subs.add(cb as (data: unknown) => void);

		// Push initial value without blocking the caller.
		void this.read<T>(path).then(cb);

		return () => {
			subs.delete(cb as (data: unknown) => void);
			if (subs.size === 0) {
				this.watchers.delete(path);
			}
		};
	}

	async exists(path: string): Promise<boolean> {
		return this.app.vault.adapter.exists(path);
	}

	async remove(path: string): Promise<void> {
		if (await this.exists(path)) {
			await this.app.vault.adapter.remove(path);
		}
	}

	// ───────────────────────── internals ─────────────────────────

	private async ensureParentDir(path: string): Promise<void> {
		const slash = path.lastIndexOf("/");
		if (slash <= 0) return;
		const parent = path.slice(0, slash);
		if (!(await this.app.vault.adapter.exists(parent))) {
			await this.app.vault.adapter.mkdir(parent);
		}
	}

	private async notifyWatchers(path: string): Promise<void> {
		const subs = this.watchers.get(path);
		if (!subs || subs.size === 0) return;
		const data = await this.read(path);
		subs.forEach((cb) => cb(data));
	}
}
