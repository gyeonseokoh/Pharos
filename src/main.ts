import { HocuspocusProvider } from "@hocuspocus/provider"
import { ConnectionManager } from "core/sync/ConnectionManager"
import { PharosSettingTab, DEFAULT_SETTINGS } from "./settings"
import type { PharosSettings } from "./settings"
import { Plugin, MarkdownView } from "obsidian"
import * as Y from 'yjs'
import { DocumentSync } from "core/sync/DocumentSync"
import { StatusBar } from './ui/StatusBar'

export default class PharosPlugin extends Plugin {
	settings!: PharosSettings
	connectionManager!: ConnectionManager
	private docSyncs = new Map<string, DocumentSync>()
	private statusBarEl!: StatusBar

	async onload(): Promise<void> {
		await this.loadSettings()

		this.connectionManager = new ConnectionManager()
		this.connectionManager.setServerUrl(this.settings.serverUrl)
		
		// StatusBar 초기화
		this.statusBarEl = new StatusBar(this.addStatusBarItem())
		this.connectionManager.onStatusChange((status) => {
			this.statusBarEl.setStatus(status)
		})

		// file-open 이벤트 발생 시 해당 마크다운 파일을 동기화하도록 지시
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (!file || file.extension !== 'md') return

				const view = this.app.workspace.getActiveViewOfType(MarkdownView)
				if (!view) return

				// documentName: workspace 내에서 같은 파일 경로 -> 동기화 대상
				const docName = `${this.settings.workspaceId}::${file.path}`

				if (!this.docSyncs.has(docName)) {
					const sync = new DocumentSync(docName, this.connectionManager)
					this.docSyncs.set(docName, sync)
				}

				this.docSyncs.get(docName)!.bindEditor(view)
			})
		)


		this.addSettingTab(new PharosSettingTab(this.app, this))
	}

	onunload(): void {
		for(const sync of this.docSyncs.values())
			sync.destroy()

		this.docSyncs.clear()
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