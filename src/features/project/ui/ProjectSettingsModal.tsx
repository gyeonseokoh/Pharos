/**
 * ProjectSettingsModal — PO-0 프로젝트 정보 수정.
 */

import { useState } from "react";
import { App, Notice } from "obsidian";
import {
	BaseReactModal,
	FormField,
	inputClass,
	ModalLayout,
	textareaClass,
} from "shared/ui";
import type { PharosPluginLike } from "../../../app/settings";

export interface ProjectSettings {
	topic: string;
	description: string;
	deadline: string;
}

function Content({
	initial,
	// 저장 로직은 Modal 클래스에서 비동기로 처리 — Content는 UI만 담당
	onSave,
	onClose,
}: {
	initial: ProjectSettings;
	onSave: (form: ProjectSettings) => Promise<void>;
	onClose: () => void;
}) {
	const [form, setForm] = useState<ProjectSettings>(initial);

	return (
		<ModalLayout
			title="⚙️ 프로젝트 설정"
			description="프로젝트 정보를 수정합니다"
			submitLabel="저장"
			onSubmit={() => {
				// 저장 성공 후 Modal 닫기, 실패 시 Modal 유지 (오류 Notice는 handleSave에서)
				void onSave(form)
					.then(() => onClose())
					.catch((err: unknown) =>
						new Notice(`[오류] 프로젝트 설정 저장 실패: ${String(err)}`),
					);
			}}
			onCancel={onClose}
		>
			<FormField label="프로젝트 주제" required>
				<input
					type="text"
					className={inputClass}
					value={form.topic}
					onChange={(e) => setForm({ ...form, topic: e.target.value })}
				/>
			</FormField>
			<FormField label="설명">
				<textarea
					className={textareaClass}
					rows={3}
					value={form.description}
					onChange={(e) => setForm({ ...form, description: e.target.value })}
				/>
			</FormField>
			<FormField label="마감기한" required>
				<input
					type="date"
					className={inputClass}
					value={form.deadline}
					onChange={(e) => setForm({ ...form, deadline: e.target.value })}
				/>
			</FormField>
		</ModalLayout>
	);
}

export class ProjectSettingsModal extends BaseReactModal {
	private readonly plugin: PharosPluginLike;
	private readonly initial: ProjectSettings;

	constructor(app: App, plugin: PharosPluginLike, initial: ProjectSettings) {
		super(app);
		this.plugin = plugin;
		this.initial = initial;
	}

	private async handleSave(form: ProjectSettings): Promise<void> {
		const project = await this.plugin.projectService.get();
		if (!project) {
			new Notice("[오류] 저장할 프로젝트를 찾을 수 없습니다");
			return;
		}

		// NewProjectModal과 동일한 topic → name 역매핑
		// fixedMeetingMode·workspaceId·planningRoadmapGenerated 등 이 Modal에
		// UI가 없는 필드는 spread로 기존 값을 그대로 보존
		await this.plugin.projectService.update({
			...project,
			name: form.topic,
			description: form.description,
			deadline: form.deadline,
		});

		// saveSettings()로 pharos:state-changed 이벤트를 발행해 Dashboard 등 리렌더 트리거
		await this.plugin.saveSettings();
		new Notice("프로젝트 설정이 저장되었습니다");
	}

	renderContent() {
		return (
			<Content
				initial={this.initial}
				onSave={(form) => this.handleSave(form)}
				onClose={() => this.close()}
			/>
		);
	}
}
