/**
 * AiTopicModal — PO-2 AI 회의 주제 제안.
 * 3~5개 주제 제시 → 선택 및 편집 → 확정 → Meeting.topics[] 저장.
 *
 * 시나리오.md PO-2:
 *   PO 버튼 트리거 → AI가 최근 회의록·진행도 종합 → 주제 3~5개 추천
 *   → PO 선택·편집 → 회의에 추가.
 *
 * AI 연동 후 교체 지점:
 *   mockSuggestions 배열 → agentService.generateTopics(recentMinutes, roadmapProgress) 결과
 *   (저장 경로 meetingsService.addTopics()는 그대로 유지)
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
import type { PharosPluginLike } from "../../../app/settings";

interface Suggestion {
	id: string;
	title: string;
	reason: string;
	selected: boolean;
}

// ── [DEMO] AI 연동 전 임시 하드코딩 주제 목록 ──────────────────────────────────
// AI 연동 PR 시 이 배열 전체를 삭제하고,
// agentService.generateTopics(recentMinutes, roadmapProgress) 결과로 교체하세요.
// ──────────────────────────────────────────────────────────────────────────────
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

function Content({
	onSave,
	onClose,
}: {
	// 저장 로직은 Modal 클래스에서 비동기 처리 — Content는 UI만 담당
	onSave: (
		selected: Suggestion[],
		customTopic: string,
	) => Promise<void>;
	onClose: () => void;
}) {
	const [suggestions, setSuggestions] = useState(mockSuggestions);
	const [customTopic, setCustomTopic] = useState("");

	const selectedSuggestions = suggestions.filter((s) => s.selected);
	const hasCustom = customTopic.trim().length > 0;
	const canSubmit = selectedSuggestions.length > 0 || hasCustom;

	const toggle = (id: string) =>
		setSuggestions((list) =>
			list.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
		);

	return (
		<ModalLayout
			title="🤖 AI 회의 주제 제안"
			description="AI가 최근 회의록 + 로드맵 진행도를 분석해 제안"
			submitLabel={`${selectedSuggestions.length + (hasCustom ? 1 : 0)}개 주제 확정`}
			submitDisabled={!canSubmit}
			onSubmit={() => {
				// 저장 성공 후 Modal 닫기, 실패 시 Modal 유지
				void onSave(selectedSuggestions, customTopic.trim())
					.then(() => onClose())
					.catch((err: unknown) =>
						new Notice(`[오류] 주제 저장 실패: ${String(err)}`),
					);
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
	private readonly plugin: PharosPluginLike;
	// 어느 회의에 주제를 추가할지 특정하기 위한 ID
	private readonly meetingId: string;

	constructor(app: App, plugin: PharosPluginLike, meetingId: string) {
		super(app);
		this.plugin = plugin;
		this.meetingId = meetingId;
	}

	/**
	 * 선택된 AI 제안 주제 + 직접 입력 주제를 Meeting.topics[]에 저장.
	 *
	 * source 구분:
	 *   - AI 제안 선택 → source: "AI"  (agentService 연동 후에도 동일)
	 *   - PO 직접 입력 → source: "MANUAL"
	 *
	 * 시나리오.md §8 데이터 흐름:
	 *   PO-2(주제 확정) → PO-5(회의록) 누적 → PO-6(개발 로드맵)
	 *   여기서 저장된 topics가 devRoadmapSimulator.analyzeMinutes()의 입력이 됨.
	 */
	private async handleSave(
		selected: Suggestion[],
		customTopic: string,
	): Promise<void> {
		const topics: Parameters<typeof this.plugin.meetingsService.addTopics>[1] = [
			// AI가 제안한 주제 — source: "AI", reason 보존
			...selected.map((s) => ({
				title: s.title,
				source: "AI" as const,
				reason: s.reason,
			})),
			// PO가 직접 입력한 주제 — source: "MANUAL", reason 없음
			...(customTopic
				? [{ title: customTopic, source: "MANUAL" as const, reason: null }]
				: []),
		];

		await this.plugin.meetingsService.addTopics(this.meetingId, topics);
		// saveSettings()로 pharos:state-changed 발행 → MeetingPage 리렌더 트리거
		await this.plugin.saveSettings();
		new Notice(`주제 ${topics.length}개가 회의에 추가되었습니다`);
	}

	renderContent() {
		return (
			<Content
				onSave={(selected, custom) => this.handleSave(selected, custom)}
				onClose={() => this.close()}
			/>
		);
	}
}
