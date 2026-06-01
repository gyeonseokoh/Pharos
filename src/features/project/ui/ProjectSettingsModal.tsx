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
	plugin,
	initial,
	onClose,
}: {
	plugin: PharosPluginLike;
	initial: ProjectSettings;
	onClose: () => void;
}) {
	const [form, setForm] = useState<ProjectSettings>(initial);
	const [submitting, setSubmitting] = useState(false);

	const canSubmit = !submitting && form.topic.trim().length > 0 && form.deadline.length > 0;

	const handleSubmit = async (): Promise<void> => {
		if (!canSubmit) return;
		setSubmitting(true);
		try {
			await plugin.projectService.update({
				name: form.topic.trim(),
				description: form.description.trim(),
				deadline: form.deadline,
			});
			new Notice("프로젝트 설정이 저장됐습니다");
			onClose();
		} catch (err) {
			new Notice(`저장 실패: ${(err as Error).message}`);
			setSubmitting(false);
		}
	};

	return (
		<ModalLayout
			title="⚙️ 프로젝트 설정"
			description="프로젝트 정보를 수정합니다"
			submitLabel={submitting ? "저장 중..." : "저장"}
			submitDisabled={!canSubmit}
			onSubmit={() => void handleSubmit()}
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

export interface ProjectSettingsModalArgs {
	plugin: PharosPluginLike;
	topic: string;
	description: string;
	deadline: string;
}

export class ProjectSettingsModal extends BaseReactModal {
	constructor(
		app: App,
		private readonly args: ProjectSettingsModalArgs,
	) {
		super(app);
	}

	renderContent() {
		return (
			<Content
				plugin={this.args.plugin}
				initial={{
					topic: this.args.topic,
					description: this.args.description,
					deadline: this.args.deadline,
				}}
				onClose={() => this.close()}
			/>
		);
	}
}
