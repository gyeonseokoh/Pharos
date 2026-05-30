/**
 * ResourceUploadModal — PO-8 수집 자료 수동 업로드.
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

interface FormState {
	title: string;
	url: string;
	summary: string;
	topicId: string;
}

interface TopicOption {
	id: string;
	title: string;
}

function Content({
	availableTopics,
	onClose,
}: {
	availableTopics: TopicOption[];
	onClose: () => void;
}) {
	const [form, setForm] = useState<FormState>({
		title: "",
		url: "",
		summary: "",
		topicId: availableTopics[0]?.id ?? "__general__",
	});

	const canSubmit =
		form.title.trim().length >= 2 && isValidUrl(form.url);

	return (
		<ModalLayout
			title="📎 자료 추가"
			description="회의에 참고할 외부 링크 · 자료"
			submitLabel="추가"
			submitDisabled={!canSubmit}
			onSubmit={() => {
				new Notice(`[미구현] 자료 "${form.title}" 추가 예정`);
				onClose();
			}}
			onCancel={onClose}
		>
			<FormField label="제목" required>
				<input
					type="text"
					className={inputClass}
					value={form.title}
					onChange={(e) => setForm({ ...form, title: e.target.value })}
				/>
			</FormField>

			<FormField label="URL" required hint="http:// 또는 https:// 로 시작">
				<input
					type="url"
					className={inputClass}
					placeholder="https://example.com"
					value={form.url}
					onChange={(e) => setForm({ ...form, url: e.target.value })}
				/>
			</FormField>

			<FormField label="요약" hint="AI 자동 요약 대신 수동 입력할 때">
				<textarea
					className={textareaClass}
					rows={3}
					value={form.summary}
					onChange={(e) => setForm({ ...form, summary: e.target.value })}
				/>
			</FormField>

			<FormField label="연결할 주제">
				<select
					className={inputClass}
					value={form.topicId}
					onChange={(e) => setForm({ ...form, topicId: e.target.value })}
				>
					<option value="__general__">전체 공용</option>
					{availableTopics.map((t) => (
						<option key={t.id} value={t.id}>
							{t.title}
						</option>
					))}
				</select>
			</FormField>
		</ModalLayout>
	);
}

function isValidUrl(s: string): boolean {
	return /^https?:\/\//.test(s);
}

export class ResourceUploadModal extends BaseReactModal {
	private readonly topics: TopicOption[];

	constructor(app: App, topics: TopicOption[]) {
		super(app);
		this.topics = topics;
	}

	renderContent() {
		return (
			<Content availableTopics={this.topics} onClose={() => this.close()} />
		);
	}
}
