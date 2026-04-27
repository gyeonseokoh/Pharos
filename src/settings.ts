import { App, PluginSettingTab, Setting } from "obsidian"
import type PharosPlugin from "main"


export interface PharosSettings {
	serverUrl: string,
	workspaceId: string
}

export const DEFAULT_SETTINGS: PharosSettings = {
	serverUrl: 'ws://localhost:1234',
	workspaceId: ''
}

export class PharosSettingTab extends PluginSettingTab {
	plugin: PharosPlugin

	constructor(app: App, plugin: PharosPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()
		containerEl.createEl('h2', { text: 'Pharos 설정' })

		new Setting(containerEl)
			.setName("서버 URL")
			.setDesc('Pharos 백엔드 서버 주소 (ex. ws://localhost:1234')
			.addText((text) => 
				text
					.setPlaceholder('ws:localhost:1234')
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.serverUrl = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('워크스페이스 ID')
			.setDesc('팀원 전원이 동일한 값을 입력해야 합니다. (예: pharos-team-01)')
			.addText((text) =>
				text
					.setPlaceholder('pharos-team-01')
					.setValue(this.plugin.settings.workspaceId)
					.onChange(async (value) => {
						this.plugin.settings.workspaceId = value
						await this.plugin.saveSettings()
					})
			)
	}
}