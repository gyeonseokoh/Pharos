/**
 * ResourceUploadModal — PO-8 수집 자료 수동 업로드.
 *
 * 흐름:
 *   1. URL·제목 입력, 연결할 주제 선택
 *   2. "추가" → meetingsService.appendResources(meetingId, [...]) 저장
 *   3. Notice + 모달 닫기 → 상위 loadAndRender가 pharos:state-changed 수신 후 갱신
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

export interface ResourceUploadModalArgs {
	plugin: PharosPluginLike;
	meetingId: string;
	topics: Array<{ id: string; title: string }>;
}

interface FormState {
	title: string;
	url: string;
	summary: string;
	topicId: string;
}

function Content({
	args,
	onClose,
}: {
	args: ResourceUploadModalArgs;
	onClose: () => void;
}) {
	const { plugin, meetingId, topics } = args;
	const [form, setForm] = useState<FormState>({
		title: "",
		url: "",
		summary: "",
		topicId: topics[0]?.id ?? "__general__",
	});
	const [submitting, setSubmitting] = useState(false);

	const canSubmit =
		!submitting &&
		form.title.trim().length >= 2 &&
		isValidUrl(form.url);

	const handleSubmit = async (): Promise<void> => {
		if (!canSubmit) return;
		setSubmitting(true);
		try {
			await plugin.meetingsService.appendResources(meetingId, [
				{
					topicId: form.topicId === "__general__" ? null : form.topicId,
					title: form.title.trim(),
					summary: form.summary.trim() || form.title.trim(),
					sourceUrl: form.url.trim(),
				},
			]);
			new Notice(`자료 "${form.title.trim()}" 추가됨`);
			onClose();
		} catch (err) {
			new Notice(`자료 추가 실패: ${(err as Error).message}`);
			setSubmitting(false);
		}
	};

	return (
		<ModalLayout
			title="📎 자료 추가"
			description="회의에 참고할 외부 링크 · 자료"
			submitLabel={submitting ? "추가 중..." : "추가"}
			submitDisabled={!canSubmit}
			onSubmit={() => void handleSubmit()}
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

			<FormField label="요약" hint="간단한 내용 설명 (선택)">
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
					{topics.map((t) => (
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
	constructor(
		app: App,
		private readonly args: ResourceUploadModalArgs,
	) {
		super(app);
	}

	renderContent() {
		return <Content args={this.args} onClose={() => this.close()} />;
	}
}
