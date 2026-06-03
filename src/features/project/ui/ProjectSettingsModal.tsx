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
	// 저장 로직은 Modal 클래스에서 비동기로 처리 — Content는 UI만 담당
	onSave,
	onClose,
}: {
	plugin: PharosPluginLike;
	initial: ProjectSettings;
	onSave: (form: ProjectSettings) => Promise<void>;
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

	// toISOString()은 UTC 기준이므로 KST(+9)에서 날짜가 어긋남 → 로컬 날짜 직접 계산
	const now = new Date();
	const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	// 오늘보다 이전 날짜면 저장 불가
	const isPastDeadline = form.deadline !== "" && form.deadline < today;

	return (
		<ModalLayout
			title="⚙️ 프로젝트 설정"
			description="프로젝트 정보를 수정합니다"
			submitLabel={submitting ? "저장 중..." : "저장"}
			submitDisabled={!canSubmit || isPastDeadline}
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
			<FormField
				label="마감기한"
				required
				// 이전 날짜 입력 시 안내 메시지 표시
				hint={isPastDeadline ? "⚠️ 이전 날짜를 입력할 수 없습니다" : undefined}
			>
				<input
					type="date"
					className={inputClass}
					value={form.deadline}
					min={today}
					max="2099-12-31"
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
		// toISOString()은 UTC 기준이므로 KST(+9)에서 날짜가 어긋남 → 로컬 날짜 직접 계산
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
		// UI 우회 입력까지 차단 — 오늘 이전 날짜는 저장 불가
		if (form.deadline && form.deadline < today) {
			new Notice("이전 날짜를 입력할 수 없습니다");
			return;
		}

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
				plugin={this.plugin}
				initial={this.initial}
				onSave={(form) => this.handleSave(form)}
				onClose={() => this.close()}
			/>
		);
	}
}
