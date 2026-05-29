/**
 * ChecklistSplitModal — PO-11 AI 업무 세분화.
 *
 * 흐름:
 *   1. PM 이 모달 열기 → "AI 세분화 시작" 클릭
 *   2. plugin.agentService.breakdownTask({ taskId, taskTitle, ... }) 호출
 *      → LLM 이 5~7개 체크리스트 항목 제안
 *   3. PM 이 편집·추가·삭제
 *   4. "N개 항목 저장" → plugin.taskService.addChecklistItems(taskId, texts)
 *
 * demoMode=true 시연 안정성:
 *   - AI 키 없거나 API 에러여도 mock 5개 후보로 흐름 시연 가능
 *   - 저장은 그대로 taskService.addChecklistItems 사용 (Vault 저장 정상)
 */

import { useState } from "react";
import { App, Notice } from "obsidian";
import { Sparkles, Loader2, X } from "lucide-react";
import {
	BaseReactModal,
	Button,
	FormField,
	inputClass,
	ModalLayout,
} from "shared/ui";
import type { PharosPluginLike } from "../../../app/settings";
import type { ChecklistSuggestion } from "../../agent/domain/agentSchema";

export interface ChecklistSplitModalArgs {
	plugin: PharosPluginLike;
	taskId: string;
	taskTitle: string;
	taskDescription?: string;
	techStack?: string[];
}

interface EditableItem {
	id: string;
	text: string;
	reason?: string;
}

// ── [DEMO] AI 미연동 시 사용할 임시 체크리스트 후보 ───────────────────────────
// 연동 완료 후 mockSuggestions + demoMode 분기 블록을 제거하세요.
// ──────────────────────────────────────────────────────────────────────────────
const mockSuggestions: ChecklistSuggestion[] = [
	{ text: "엔드포인트 정의 (POST /auth/login)", reason: "API 계약 명확화" },
	{ text: "JWT 토큰 발급 로직", reason: "세션 관리 핵심" },
	{ text: "bcrypt 비밀번호 해시·검증", reason: "보안 요구사항" },
	{ text: "세션 저장 (SQLite)", reason: "재접속 대응" },
	{ text: "단위 테스트 케이스 작성", reason: "회귀 방지" },
];
const MOCK_SUMMARY = "인증 기능을 5단계로 분해. 보안·테스트 항목 포함.";

function Content({
	args,
	onClose,
}: {
	args: ChecklistSplitModalArgs;
	onClose: () => void;
}) {
	const { plugin, taskId, taskTitle, taskDescription, techStack } = args;
	const isDemo = plugin.settings.demoMode;

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [summary, setSummary] = useState<string>("");
	const [items, setItems] = useState<EditableItem[]>([]);
	const [newText, setNewText] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const fetchSuggestions = async (): Promise<void> => {
		setError(null);
		setItems([]);
		setLoading(true);
		try {
			let suggestions: ChecklistSuggestion[];
			let summaryText: string;

			if (isDemo) {
				await new Promise<void>((resolve) => setTimeout(resolve, 600));
				suggestions = mockSuggestions;
				summaryText = MOCK_SUMMARY;
			} else {
				const result = await plugin.agentService.breakdownTask({
					taskId,
					taskTitle,
					taskDescription,
					techStack,
				});
				suggestions = result.items;
				summaryText = result.summary;
			}

			const now = Date.now();
			setItems(
				suggestions.map((s, i) => ({
					id: `sug-${now}-${i}`,
					text: s.text,
					reason: s.reason,
				})),
			);
			setSummary(summaryText);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	};

	const update = (id: string, text: string) =>
		setItems((cur) => cur.map((it) => (it.id === id ? { ...it, text } : it)));
	const remove = (id: string) =>
		setItems((cur) => cur.filter((it) => it.id !== id));
	const add = () => {
		const text = newText.trim();
		if (!text) return;
		setItems((cur) => [...cur, { id: `manual-${Date.now()}`, text }]);
		setNewText("");
	};

	const handleSubmit = async (): Promise<void> => {
		if (submitting) return;
		setSubmitting(true);
		try {
			const texts = items.map((it) => it.text);
			if (isDemo) {
				await new Promise<void>((resolve) => setTimeout(resolve, 300));
				new Notice(`[DEMO] 체크리스트 ${texts.length}개 추가됨 (${taskTitle})`);
				onClose();
				return;
			}
			const saved = await plugin.taskService.addChecklistItems(taskId, texts);
			new Notice(`체크리스트 ${saved.length}개 추가됨 (${taskTitle})`);
			onClose();
		} catch (err) {
			new Notice(`체크리스트 저장 실패: ${(err as Error).message}`);
			setSubmitting(false);
		}
	};

	const headerHint = summary
		? summary
		: isDemo
			? "[DEMO] 시연용 체크리스트 후보 — 실제 AI 호출 우회"
			: "AI 가 Task 제목·설명·기술스택을 분석해 5~7개 항목을 제안합니다.";

	return (
		<ModalLayout
			title="🤖 AI 업무 세분화"
			description={`Task "${taskTitle}" 를 체크리스트로 쪼갭니다`}
			submitLabel={
				submitting ? "저장 중..." : `${items.length}개 항목 저장`
			}
			submitDisabled={items.length < 1 || submitting}
			onSubmit={() => void handleSubmit()}
			onCancel={onClose}
			widthClass="max-w-xl"
		>
			<div className="mb-4 flex items-start gap-2 text-xs text-text-muted">
				<Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--interactive-accent)]" />
				<span>{headerHint}</span>
			</div>

			{items.length === 0 ? (
				<FormField label="✨ AI 제안 받기">
					<Button
						variant="secondary"
						onClick={() => void fetchSuggestions()}
						disabled={loading}
						className="w-full"
					>
						{loading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								AI 분석 중...
							</>
						) : (
							<>
								<Sparkles className="mr-2 h-4 w-4" />
								AI 세분화 시작
							</>
						)}
					</Button>
					{error && (
						<p className="mt-2 text-xs text-[color:var(--color-red)]">
							{error}
						</p>
					)}
				</FormField>
			) : (
				<>
					<FormField label={`체크리스트 (${items.length}개)`}>
						<ul className="space-y-2">
							{items.map((it, i) => (
								<li key={it.id} className="flex items-start gap-2">
									<span className="mt-2 w-5 shrink-0 text-[11px] font-bold text-text-faint">
										{i + 1}.
									</span>
									<div className="flex-1 min-w-0">
										<input
											type="text"
											className={inputClass}
											value={it.text}
											onChange={(e) => update(it.id, e.target.value)}
										/>
										{it.reason && (
											<p className="mt-0.5 text-[11px] text-text-faint">
												💡 {it.reason}
											</p>
										)}
									</div>
									<button
										onClick={() => remove(it.id)}
										className="mt-2 shrink-0 rounded p-1 text-text-faint hover:bg-[color:var(--color-red)]/10 hover:text-[color:var(--color-red)]"
										aria-label="삭제"
									>
										<X className="h-3.5 w-3.5" />
									</button>
								</li>
							))}
						</ul>
					</FormField>

					<FormField label="항목 추가">
						<div className="flex gap-2">
							<input
								type="text"
								className={inputClass}
								placeholder="새 체크 항목..."
								value={newText}
								onChange={(e) => setNewText(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										add();
									}
								}}
							/>
							<Button variant="secondary" onClick={add}>
								추가
							</Button>
						</div>
					</FormField>

					<Button
						variant="ghost"
						onClick={() => void fetchSuggestions()}
						disabled={loading}
						className="w-full text-xs"
					>
						{loading ? "..." : "🔄 다시 AI 제안 받기 (현재 항목 초기화)"}
					</Button>
				</>
			)}
		</ModalLayout>
	);
}

export class ChecklistSplitModal extends BaseReactModal {
	constructor(
		app: App,
		private readonly args: ChecklistSplitModalArgs,
	) {
		super(app);
	}

	renderContent() {
		return <Content args={this.args} onClose={() => this.close()} />;
	}
}
