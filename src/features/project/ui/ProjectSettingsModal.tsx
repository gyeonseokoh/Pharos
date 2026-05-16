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

export interface ProjectSettings {
	topic: string;
	description: string;
	deadline: string;
}

function Content({
	initial,
	onClose,
}: {
	initial: ProjectSettings;
	onClose: () => void;
}) {
	const [form, setForm] = useState<ProjectSettings>(initial);

	return (
		<ModalLayout
			title="⚙️ 프로젝트 설정"
			description="프로젝트 정보를 수정합니다"
			submitLabel="저장"
			onSubmit={() => {
				new Notice(`[미구현] 프로젝트 설정 저장 예정`);
				onClose();
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
	private readonly initial: ProjectSettings;

	constructor(app: App, initial: ProjectSettings) {
		super(app);
		this.initial = initial;
	}

	renderContent() {
		return <Content initial={this.initial} onClose={() => this.close()} />;
	}
}
