/**
 * AiTopicModal — PO-2 AI 회의 주제 제안.
 * 3~5개 주제 제시 → 선택 및 편집 → 확정.
 */

import { useState } from "react";
import { App, Notice } from "obsidian";
import { Sparkles } from "lucide-react";
import {
	BaseReactModal,
	FormField,
	inputClass,
	ModalLayout,
} from "shared/ui";
import { cn } from "shared/ui/utils";

interface Suggestion {
	id: string;
	title: string;
	reason: string;
	selected: boolean;
}

const mockSuggestions: Suggestion[] = [
	{
		id: "s1",
		title: "Dashboard vs 공개 진행도 페이지 구분",
		reason: "이전 회의록에서 '페이지 중복 느낌' 피드백 2회 언급",
		selected: true,
	},
	{
		id: "s2",
		title: "Modal vs Full-page 패턴 결정",
		reason: "when2meet 그리드가 일반 Modal에 맞을지 검증 필요",
		selected: true,
	},
	{
		id: "s3",
		title: "Tailwind 커스텀 색상 정책",
		reason: "Obsidian 변수 직접 참조 vs 자체 팔레트 중 고민",
		selected: false,
	},
	{
		id: "s4",
		title: "Hot Reload 플러그인 의존성",
		reason: "팀원 온보딩 시 수동 설치 필요 여부 확인",
		selected: false,
	},
];

function Content({ onClose }: { onClose: () => void }) {
	const [suggestions, setSuggestions] = useState(mockSuggestions);
	const [customTopic, setCustomTopic] = useState("");

	const selectedCount = suggestions.filter((s) => s.selected).length;
	const canSubmit = selectedCount > 0 || customTopic.trim().length > 0;

	const toggle = (id: string) =>
		setSuggestions((list) =>
			list.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
		);

	return (
		<ModalLayout
			title="🤖 AI 회의 주제 제안"
			description="GPT-4o-mini가 최근 회의록 + 로드맵 진행도를 분석해 제안"
			submitLabel={`${selectedCount}개 주제 확정`}
			submitDisabled={!canSubmit}
			onSubmit={() => {
				new Notice(`[미구현] ${selectedCount}개 주제 회의에 추가 예정`);
				onClose();
			}}
			onCancel={onClose}
			widthClass="max-w-xl"
		>
			<div className="mb-4 flex items-center gap-2 text-xs text-text-muted">
				<Sparkles className="h-3.5 w-3.5 text-[color:var(--interactive-accent)]" />
				<span>체크박스로 선택 · 제목 클릭하면 편집</span>
			</div>

			<div className="space-y-2">
				{suggestions.map((s, i) => (
					<SuggestionRow
						key={s.id}
						index={i + 1}
						suggestion={s}
						onToggle={() => toggle(s.id)}
						onChangeTitle={(title) =>
							setSuggestions((list) =>
								list.map((x) => (x.id === s.id ? { ...x, title } : x)),
							)
						}
					/>
				))}
			</div>

			<FormField
				label="직접 주제 추가"
				hint="AI 제안 외에 PO가 직접 넣을 주제"
			>
				<input
					type="text"
					className={inputClass}
					placeholder="예: 배포 일정 확인"
					value={customTopic}
					onChange={(e) => setCustomTopic(e.target.value)}
				/>
			</FormField>
		</ModalLayout>
	);
}

function SuggestionRow({
	index,
	suggestion,
	onToggle,
	onChangeTitle,
}: {
	index: number;
	suggestion: Suggestion;
	onToggle: () => void;
	onChangeTitle: (title: string) => void;
}) {
	const [editing, setEditing] = useState(false);

	return (
		<div
			className={cn(
				"flex items-start gap-3 rounded-md border p-3 transition-colors",
				suggestion.selected
					? "border-[color:var(--interactive-accent)] bg-[color:var(--interactive-accent)]/5"
					: "border-bg-modifier bg-bg-secondary",
			)}
		>
			<input
				type="checkbox"
				checked={suggestion.selected}
				onChange={onToggle}
				className="mt-1 shrink-0"
			/>
			<div className="flex-1 min-w-0">
				<div className="flex items-baseline gap-2">
					<span className="text-[11px] font-bold text-text-faint">
						#{index}
					</span>
					{editing ? (
						<input
							type="text"
							className="flex-1 rounded border border-bg-modifier bg-bg-secondary px-2 py-0.5 text-sm font-medium text-text-normal"
							value={suggestion.title}
							onChange={(e) => onChangeTitle(e.target.value)}
							onBlur={() => setEditing(false)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === "Escape") setEditing(false);
							}}
							autoFocus
						/>
					) : (
						<button
							onClick={() => setEditing(true)}
							className="flex-1 text-left text-sm font-medium text-text-normal hover:underline"
						>
							{suggestion.title}
						</button>
					)}
				</div>
				<p className="mt-0.5 text-[11px] italic text-text-faint">
					💭 {suggestion.reason}
				</p>
			</div>
		</div>
	);
}

export class AiTopicModal extends BaseReactModal {
	renderContent() {
		return <Content onClose={() => this.close()} />;
	}
}
