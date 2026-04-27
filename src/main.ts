import { HocuspocusProvider } from "@hocuspocus/provider"
import { ConnectionManager } from "core/sync/ConnectionManager"
import { PharosSettingTab, DEFAULT_SETTINGS } from "./settings"
import type { PharosSettings } from "./settings"
import { Plugin } from "obsidian"
import * as Y from 'yjs'

export default class PharosPlugin extends Plugin {
	settings!: PharosSettings
	connectionManager!: ConnectionManager

	// 검증용 임시
	private _testProvider: HocuspocusProvider | null = null

	async onload(): Promise<void> {
		await this.loadSettings()

		this.connectionManager = new ConnectionManager()
		this.connectionManager.setServerUrl(this.settings.serverUrl)

		// 검증용 임시 provider
		// DocumentSync.open()으로 교체되면 제거
		this._testProvider = this.connectionManager.acquire({
			documentName: `${this.app.vault.getName()}-test`,
			doc: new Y.Doc(),
		})

		this._testProvider.on('connect', () => console.log('[Pharos] test provider connected'))
		this._testProvider.on('synced',  () => console.log('[Pharos] test provider synced'))

		this.addSettingTab(new PharosSettingTab(this.app, this))
	}

	onunload(): void {
		this.connectionManager.destroyAll()
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<PharosSettings>
		)
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings)
	}
}