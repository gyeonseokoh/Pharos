/**
 * MinutesUploadModal — PO-5 회의록 업로드/작성 모달.
 *
 * 시나리오:
 *   Phase 1 (input): 회의 선택 + 입력/파일 업로드 + 작성자
 *   Phase 2 (progress): 5단계 분석 애니메이션 (각 ~500ms)
 *   Phase 3 (preview): 추출 결과 확인 → 승인/재분석/취소
 *
 * 승인 시 onApprove(meetingId, AttachedMinute) 콜백으로 상위에 전달.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { App } from "obsidian";
import {
	CheckCircle2,
	FileUp,
	Loader2,
	PencilLine,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import {
	BaseReactModal,
	Button,
	FormField,
	ModalLayout,
	inputClass,
	textareaClass,
} from "shared/ui";
import { cn } from "shared/ui/utils";
import type { MeetingAnalysis, MeetingPageData } from "../domain/meetingPageData";
import type { AttachedMinute } from "../../../app/settings";
import {
	MINUTES_ANALYSIS_STEPS,
	analyzeMinutes,
} from "./minutesAnalysisSimulator";

export interface MinutesUploadModalArgs {
	/** 회의록 없는 회의 후보. 드롭다운에 표시. */
	candidates: MeetingPageData[];
	/** 초기 작성자 이름 (예: 로그인 유저). */
	defaultAuthorName: string;
	/** 승인 시 상위가 settings.attachedMinutes에 저장. */
	onApprove: (
		meetingId: string,
		attached: AttachedMinute,
	) => void | Promise<void>;
}

type Phase = "input" | "progress" | "preview";
type InputMode = "direct" | "file";

function Content({
	args,
	onClose,
}: {
	args: MinutesUploadModalArgs;
	onClose: () => void;
}) {
	const [phase, setPhase] = useState<Phase>("input");
	const [mode, setMode] = useState<InputMode>("direct");

	const [meetingId, setMeetingId] = useState<string>(
		args.candidates[0]?.id ?? "",
	);
	const [authorName, setAuthorName] = useState(args.defaultAuthorName);
	const [content, setContent] = useState("");
	const [fileName, setFileName] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [stepIndex, setStepIndex] = useState(0);
	const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);

	const selectedMeeting = useMemo(
		() => args.candidates.find((m) => m.id === meetingId) ?? null,
		[args.candidates, meetingId],
	);

	const canSubmit =
		selectedMeeting !== null &&
		authorName.trim().length > 0 &&
		content.trim().length >= 20;

	// 분석 애니메이션
	useEffect(() => {
		if (phase !== "progress") return;
		let cancelled = false;

		const run = async () => {
			for (let i = 0; i < MINUTES_ANALYSIS_STEPS.length; i++) {
				if (cancelled) return;
				setStepIndex(i);
				await sleep(500);
			}
			if (cancelled) return;
			const result = analyzeMinutes({ content });
			setAnalysis(result);
			setPhase("preview");
		};

		void run();
		return () => {
			cancelled = true;
		};
	}, [phase, content]);

	const handleFile = (file: File | null) => {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const text = typeof reader.result === "string" ? reader.result : "";
			setContent(text);
			setFileName(file.name);
		};
		reader.readAsText(file, "utf-8");
	};

	const approve = async () => {
		if (!analysis || !selectedMeeting) return;
		const attached: AttachedMinute = {
			minutes: {
				content,
				authorName: authorName.trim(),
				writtenAt: new Date().toISOString(),
			},
			analysis,
		};
		await args.onApprove(selectedMeeting.id, attached);
		onClose();
	};

	// ───── Phase: input ─────
	if (phase === "input") {
		if (args.candidates.length === 0) {
			return (
				<ModalLayout
					title="✍️ 회의록 작성"
					onCancel={onClose}
					widthClass="max-w-lg"
				>
					<div className="rounded-md border border-dashed border-bg-modifier bg-bg-secondary p-6 text-center">
						<p className="text-sm text-text-muted">
							회의록이 필요한 회의가 없습니다.
						</p>
						<p className="mt-2 text-[11px] text-text-faint">
							캘린더에서 새 회의를 추가하거나, 기존 회의의 회의록을 편집하세요.
						</p>
					</div>
				</ModalLayout>
			);
		}

		return (
			<ModalLayout
				title="✍️ 회의록 작성"
				description="회의를 선택하고 본문을 직접 쓰거나 파일로 업로드하세요"
				submitLabel="분석 시작"
				submitDisabled={!canSubmit}
				onSubmit={() => setPhase("progress")}
				onCancel={onClose}
				widthClass="max-w-xl"
			>
				<FormField label="대상 회의" required>
					<select
						className={inputClass}
						value={meetingId}
						onChange={(e) => setMeetingId(e.target.value)}
					>
						{args.candidates.map((m) => (
							<option key={m.id} value={m.id}>
								{formatMeetingOption(m)}
							</option>
						))}
					</select>
				</FormField>

				<FormField label="작성자" required>
					<input
						type="text"
						className={inputClass}
						value={authorName}
						onChange={(e) => setAuthorName(e.target.value)}
					/>
				</FormField>

				<FormField label="회의록 입력 방식">
					<ModeTabs mode={mode} onChange={setMode} />
				</FormField>

				{mode === "direct" ? (
					<FormField label="본문" required hint="20자 이상 권장">
						<textarea
							className={cn(textareaClass, "min-h-[220px]")}
							value={content}
							onChange={(e) => {
								setContent(e.target.value);
								setFileName(null);
							}}
							placeholder={"예:\n결정사항:\n- 아키텍처 Feature-based 확정\n- 기술스택: Yjs, Hocuspocus\n..."}
						/>
					</FormField>
				) : (
					<FormField label="파일 업로드" hint=".txt, .md (UTF-8)">
						<div className="space-y-2">
							<input
								ref={fileInputRef}
								type="file"
								accept=".txt,.md,text/plain,text/markdown"
								className="hidden"
								onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
							/>
							<Button
								variant="outline"
								onClick={() => fileInputRef.current?.click()}
							>
								<FileUp className="h-3.5 w-3.5" />
								파일 선택
							</Button>
							{fileName && (
								<p className="text-[11px] text-text-muted">
									📎 {fileName} · {content.length}자 읽음
								</p>
							)}
							{content && (
								<details className="rounded-md border border-bg-modifier bg-bg-secondary p-2">
									<summary className="cursor-pointer text-[11px] text-text-muted">
										미리보기 (처음 500자)
									</summary>
									<pre className="mt-2 max-h-[160px] overflow-y-auto whitespace-pre-wrap break-words text-[11px] text-text-muted">
										{content.slice(0, 500)}
										{content.length > 500 ? "…" : ""}
									</pre>
								</details>
							)}
						</div>
					</FormField>
				)}
			</ModalLayout>
		);
	}

	// ───── Phase: progress ─────
	if (phase === "progress") {
		return (
			<ModalLayout
				title="🔍 회의록 분석 중"
				description="AI가 회의록을 분석하고 있습니다..."
				onCancel={onClose}
				widthClass="max-w-xl"
			>
				<ProgressList currentIndex={stepIndex} />
				<p className="mt-4 text-[11px] text-text-faint">
					시뮬레이션 단계 · 실제 LLM 연동 시 이 부분이 교체됩니다.
				</p>
			</ModalLayout>
		);
	}

	// ───── Phase: preview ─────
	return (
		<ModalLayout
			title="📋 분석 결과 확인"
			description="추출된 내용을 확인하고 승인하면 회의록 관리에 저장됩니다"
			onCancel={onClose}
			widthClass="max-w-2xl"
		>
			{analysis && selectedMeeting && (
				<PreviewBody
					meeting={selectedMeeting}
					analysis={analysis}
					content={content}
				/>
			)}
			<footer className="mt-6 flex items-center justify-end gap-2 border-t border-bg-modifier pt-3">
				<Button variant="ghost" onClick={onClose}>
					취소
				</Button>
				<Button
					variant="outline"
					onClick={() => {
						setAnalysis(null);
						setStepIndex(0);
						setPhase("progress");
					}}
				>
					<RefreshCw className="h-3.5 w-3.5" />
					다시 분석
				</Button>
				<Button onClick={() => void approve()}>
					<CheckCircle2 className="h-3.5 w-3.5" />
					승인 · 회의록 저장
				</Button>
			</footer>
		</ModalLayout>
	);
}

function ModeTabs({
	mode,
	onChange,
}: {
	mode: InputMode;
	onChange: (m: InputMode) => void;
}) {
	const tabs: { id: InputMode; label: string; icon: typeof PencilLine }[] = [
		{ id: "direct", label: "직접 입력", icon: PencilLine },
		{ id: "file", label: "파일 업로드", icon: FileUp },
	];
	return (
		<div className="inline-flex rounded-md border border-bg-modifier bg-bg-secondary p-0.5">
			{tabs.map((t) => {
				const Icon = t.icon;
				const active = mode === t.id;
				return (
					<button
						key={t.id}
						type="button"
						onClick={() => onChange(t.id)}
						className={cn(
							"flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-colors",
							active
								? "bg-[color:var(--interactive-accent)] text-[color:var(--text-on-accent)]"
								: "text-text-muted hover:bg-[color:var(--background-modifier-hover)]",
						)}
					>
						<Icon className="h-3 w-3" />
						{t.label}
					</button>
				);
			})}
		</div>
	);
}

function ProgressList({ currentIndex }: { currentIndex: number }) {
	return (
		<ul className="space-y-2">
			{MINUTES_ANALYSIS_STEPS.map((step, i) => {
				const state =
					i < currentIndex ? "done" : i === currentIndex ? "active" : "pending";
				return (
					<li
						key={step.id}
						className={cn(
							"flex items-center gap-3 rounded-md border px-3 py-2 text-xs transition-colors",
							state === "done" &&
								"border-[color:var(--color-green)]/30 bg-[color:var(--color-green)]/5",
							state === "active" &&
								"border-[color:var(--interactive-accent)] bg-[color:var(--interactive-accent)]/10",
							state === "pending" && "border-bg-modifier bg-bg-secondary",
						)}
					>
						<StepIcon state={state} />
						<span
							className={cn(
								"flex-1",
								state === "pending" && "text-text-faint",
								state === "active" &&
									"font-semibold text-[color:var(--interactive-accent)]",
								state === "done" && "text-text-muted",
							)}
						>
							{i + 1}/{MINUTES_ANALYSIS_STEPS.length} {step.label}
						</span>
					</li>
				);
			})}
		</ul>
	);
}

function StepIcon({ state }: { state: "done" | "active" | "pending" }) {
	if (state === "done") {
		return (
			<CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--color-green)]" />
		);
	}
	if (state === "active") {
		return (
			<Loader2 className="h-4 w-4 shrink-0 animate-spin text-[color:var(--interactive-accent)]" />
		);
	}
	return (
		<span className="h-4 w-4 shrink-0 rounded-full border border-bg-modifier" />
	);
}

function PreviewBody({
	meeting,
	analysis,
	content,
}: {
	meeting: MeetingPageData;
	analysis: MeetingAnalysis;
	content: string;
}) {
	return (
		<div className="space-y-4">
			<div className="rounded-md border border-[color:var(--interactive-accent)]/30 bg-[color:var(--interactive-accent)]/5 p-3">
				<p className="flex items-center gap-2 text-xs font-semibold text-[color:var(--interactive-accent)]">
					<Sparkles className="h-3.5 w-3.5" />
					{meeting.title} · {meeting.date}
				</p>
				<p className="mt-1 text-[11px] text-text-muted">
					{content.length}자 · 키워드 {analysis.keywords.length}개 · 기술스택{" "}
					{analysis.techStacks.length}개 · 결정사항{" "}
					{analysis.decisions.length}개
				</p>
			</div>

			<Section title="📝 요약">
				<p className="text-xs leading-relaxed text-text-normal">
					{analysis.summary}
				</p>
			</Section>

			{analysis.keywords.length > 0 && (
				<Section title="🔑 핵심 키워드">
					<div className="flex flex-wrap gap-1.5">
						{analysis.keywords.map((k) => (
							<span
								key={k}
								className="rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] text-text-muted"
							>
								{k}
							</span>
						))}
					</div>
				</Section>
			)}

			{analysis.techStacks.length > 0 && (
				<Section title="⚙️ 기술 스택 후보">
					<div className="flex flex-wrap gap-1.5">
						{analysis.techStacks.map((t) => (
							<span
								key={t}
								className="rounded-md border border-[color:var(--color-blue)]/30 bg-[color:var(--color-blue)]/5 px-2 py-0.5 text-[11px] text-[color:var(--color-blue)]"
							>
								{t}
							</span>
						))}
					</div>
				</Section>
			)}

			{analysis.decisions.length > 0 && (
				<Section title="✅ 주요 결정사항">
					<ul className="space-y-1">
						{analysis.decisions.map((d, i) => (
							<li
								key={i}
								className="rounded-md border-l-2 border-[color:var(--color-green)] bg-[color:var(--color-green)]/5 py-1 pl-2 pr-2 text-[11px] text-text-muted"
							>
								{d}
							</li>
						))}
					</ul>
				</Section>
			)}
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<h3 className="mb-2 text-xs font-semibold text-text-normal">{title}</h3>
			{children}
		</div>
	);
}

function formatMeetingOption(m: MeetingPageData): string {
	const typeLabel = m.type === "regular" ? "정기" : "임시";
	return `[${typeLabel}] ${m.date} ${m.time} · ${m.title}`;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MinutesUploadModal extends BaseReactModal {
	constructor(
		app: App,
		private readonly args: MinutesUploadModalArgs,
	) {
		super(app);
	}

	renderContent() {
		return <Content args={this.args} onClose={() => this.close()} />;
	}
}
