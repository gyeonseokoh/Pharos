/**
 * AiTopicModal — PO-2 AI 회의 주제 제안.
 *
 * 흐름:
 *   1. 모달 열림 → "AI 주제 제안 받기" 클릭
 *   2. 가장 최근 회의록 있는 회의 찾기
 *      → plugin.agentService.summarizeMinutes({meetingId}) 호출
 *      → result.suggestedTopics 가 다음 회의 주제 후보 (3~5개)
 *   3. PO 가 체크박스 선택 / 제목 편집 / 직접 주제 추가
 *   4. "N개 주제 확정" → plugin.meetingsService.appendTopics(meetingId, items)
 *
 * meetingId 입력:
 *   - 호출처가 명시 (MeetingPage) → 그 회의에 추가
 *   - 미지정 (Dashboard) → 모달 안에서 회의 선택 드롭다운 표시
 *
 * demoMode=true 시연 안정성:
 *   - 직전 회의록 없거나 AI 키 없어도 mock 4개 후보 표시
 */

import { useEffect, useMemo, useState } from "react";
import { App, Notice } from "obsidian";
import { Loader2, Sparkles } from "lucide-react";
import {
	BaseReactModal,
	Button,
	FormField,
	inputClass,
	ModalLayout,
} from "shared/ui";
import { cn } from "shared/ui/utils";
import type { PharosPluginLike } from "../../../app/settings";
import type { Meeting } from "../domain/meetingSchema";

export interface AiTopicModalArgs {
	plugin: PharosPluginLike;
	/** 호출처가 특정 회의를 지정하면 그 회의에 주제 추가. 없으면 드롭다운 선택. */
	meetingId?: string;
}

interface Suggestion {
	id: string;
	title: string;
	reason: string;
	selected: boolean;
}

// ── [DEMO] AI 미연동 시 사용할 임시 주제 후보 ─────────────────────────────────
// 연동 완료 후 mockSuggestions 와 demoMode 분기 제거.
// ──────────────────────────────────────────────────────────────────────────────
const MOCK_SUGGESTIONS: Suggestion[] = [
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
	args,
	onClose,
}: {
	args: AiTopicModalArgs;
	onClose: () => void;
}) {
	const { plugin } = args;
	const isDemo = plugin.settings.demoMode;

	const [meetings, setMeetings] = useState<Meeting[]>([]);
	const [meetingId, setMeetingId] = useState<string>(args.meetingId ?? "");
	const [loadingMeetings, setLoadingMeetings] = useState(true);

	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);
	const [suggestionError, setSuggestionError] = useState<string | null>(null);

	const [customTopic, setCustomTopic] = useState("");
	const [submitting, setSubmitting] = useState(false);

	// 후보 회의 (status != completed) 로드
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const list = await plugin.meetingsService.list();
				if (cancelled) return;
				const candidates = list.filter((m) => m.status !== "completed");
				setMeetings(candidates);
				if (!args.meetingId && candidates.length > 0 && !meetingId) {
					setMeetingId(candidates[0]!.id);
				}
			} finally {
				if (!cancelled) setLoadingMeetings(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [plugin, args.meetingId, meetingId]);

	const targetMeeting = useMemo(
		() => meetings.find((m) => m.id === meetingId) ?? null,
		[meetings, meetingId],
	);

	const selectedCount = suggestions.filter((s) => s.selected).length;
	const canSubmit =
		!submitting &&
		meetingId.length > 0 &&
		(selectedCount > 0 || customTopic.trim().length > 0);

	const toggle = (id: string) =>
		setSuggestions((list) =>
			list.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
		);

	const updateTitle = (id: string, title: string) =>
		setSuggestions((list) =>
			list.map((s) => (s.id === id ? { ...s, title } : s)),
		);

	const fetchSuggestions = async (): Promise<void> => {
		setSuggestionError(null);
		setLoadingSuggestions(true);
		try {
			if (isDemo) {
				await new Promise<void>((resolve) => setTimeout(resolve, 600));
				setSuggestions(MOCK_SUGGESTIONS.map((s) => ({ ...s })));
				return;
			}

			// 실모드: 가장 최근 회의록이 있는 회의를 찾아 그 회의록 요약 → suggestedTopics
			const all = await plugin.meetingsService.list();
			const withMinutes = all
				.filter((m) => m.minutes !== null)
				.sort((a, b) =>
					(b.minutes!.writtenAt > a.minutes!.writtenAt ? 1 : -1),
				);
			const source = withMinutes[0];
			if (!source) {
				setSuggestionError(
					"분석할 이전 회의록이 없습니다. 회의록을 1건 이상 작성한 뒤 다시 시도해주세요.",
				);
				return;
			}

			const result = await plugin.agentService.summarizeMinutes({
				meetingId: source.id,
			});
			const now = Date.now();
			setSuggestions(
				result.suggestedTopics.map((title, i) => ({
					id: `sug-${now}-${i}`,
					title,
					reason: `최근 회의 "${source.title}" 분석 기반 제안`,
					selected: true,
				})),
			);
		} catch (err) {
			setSuggestionError((err as Error).message);
		} finally {
			setLoadingSuggestions(false);
		}
	};

	const handleSubmit = async (): Promise<void> => {
		if (submitting || !meetingId) return;
		setSubmitting(true);
		try {
			const items: Array<{
				title: string;
				source: "AI" | "MANUAL";
				reason: string | null;
			}> = [];
			for (const s of suggestions) {
				if (!s.selected) continue;
				items.push({ title: s.title, source: "AI", reason: s.reason });
			}
			const manual = customTopic.trim();
			if (manual.length > 0) {
				items.push({ title: manual, source: "MANUAL", reason: null });
			}

			const added = await plugin.meetingsService.appendTopics(meetingId, items);
			const targetTitle = targetMeeting?.title ?? meetingId;
			new Notice(`주제 ${added.length}개 추가됨 (${targetTitle})`);
			onClose();
		} catch (err) {
			new Notice(`주제 추가 실패: ${(err as Error).message}`);
			setSubmitting(false);
		}
	};

	const showMeetingPicker = !args.meetingId;
	const headerHint = isDemo
		? "[DEMO] 시연용 추천 후보 — 실제 AI 호출 우회"
		: "이전 회의록 요약 기반으로 다음 회의 주제를 제안합니다.";

	return (
		<ModalLayout
			title="🤖 AI 회의 주제 제안"
			description={headerHint}
			submitLabel={
				submitting
					? "추가 중..."
					: `${selectedCount + (customTopic.trim() ? 1 : 0)}개 주제 확정`
			}
			submitDisabled={!canSubmit}
			onSubmit={() => void handleSubmit()}
			onCancel={onClose}
			widthClass="max-w-xl"
		>
			{showMeetingPicker && (
				<FormField label="대상 회의" required>
					{loadingMeetings ? (
						<p className="text-xs text-text-faint">회의 목록 로드 중...</p>
					) : meetings.length === 0 ? (
						<p className="text-xs text-[color:var(--color-orange)]">
							주제를 추가할 회의가 없습니다. 캘린더에서 회의를 먼저
							만들어주세요.
						</p>
					) : (
						<select
							className={inputClass}
							value={meetingId}
							onChange={(e) => setMeetingId(e.target.value)}
						>
							{meetings.map((m) => (
								<option key={m.id} value={m.id}>
									{formatMeetingOption(m)}
								</option>
							))}
						</select>
					)}
				</FormField>
			)}

			{suggestions.length === 0 ? (
				<FormField label="✨ AI 제안 받기">
					<Button
						variant="secondary"
						onClick={() => void fetchSuggestions()}
						disabled={loadingSuggestions}
						className="w-full"
					>
						{loadingSuggestions ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								AI 분석 중...
							</>
						) : (
							<>
								<Sparkles className="mr-2 h-4 w-4" />
								AI 주제 제안 받기
							</>
						)}
					</Button>
					{suggestionError && (
						<p className="mt-2 text-xs text-[color:var(--color-red)]">
							{suggestionError}
						</p>
					)}
				</FormField>
			) : (
				<>
					<div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
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
								onChangeTitle={(title) => updateTitle(s.id, title)}
							/>
						))}
					</div>

					<Button
						variant="ghost"
						onClick={() => void fetchSuggestions()}
						disabled={loadingSuggestions}
						className="mt-3 w-full text-xs"
					>
						{loadingSuggestions ? "..." : "🔄 다시 AI 제안 받기"}
					</Button>
				</>
			)}

			<FormField label="직접 주제 추가" hint="AI 제안 외에 PO 가 직접 넣을 주제">
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
								if (e.key === "Enter" || e.key === "Escape")
									setEditing(false);
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

function formatMeetingOption(m: Meeting): string {
	const typeLabel = m.meetingType === "regular" ? "정기" : "임시";
	return `[${typeLabel}] ${m.date} ${m.time} · ${m.title}`;
}

export class AiTopicModal extends BaseReactModal {
	constructor(
		app: App,
		private readonly args: AiTopicModalArgs,
	) {
		super(app);
	}

	renderContent() {
		return <Content args={this.args} onClose={() => this.close()} />;
	}
}
