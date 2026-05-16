/**
 * DevRoadmapGenerateModal — PO-6 개발 로드맵 생성 모달.
 *
 * 시나리오:
 *   Phase 1 (progress): 5단계 AI 분석 애니메이션 (각 ~1초)
 *   Phase 2 (preview): 생성된 로드맵 미리보기 → PO 승인/재생성/취소
 *
 * 승인 시 onApprove 콜백으로 생성된 RoadmapData 전달. 상위 ItemView가 settings에 저장.
 */

import { useEffect, useMemo, useState } from "react";
import { App } from "obsidian";
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
	BaseReactModal,
	Button,
	ModalLayout,
} from "shared/ui";
import { cn } from "shared/ui/utils";
import type { MeetingPageData } from "../../meeting/domain/meetingPageData";
import type { TeamMember } from "../../team/domain/teamListData";
import type { ProjectReport } from "../../../app/settings";
import type { RoadmapData } from "../domain/roadmapData";
import {
	DEV_ROADMAP_STEPS,
	generateDevelopmentRoadmap,
	type DevRoadmapStepKey,
} from "./devRoadmapSimulator";

export interface DevRoadmapGenerateModalArgs {
	report: ProjectReport;
	meetings: MeetingPageData[];
	members: TeamMember[];
	planningEndIso: string;
	onApprove: (roadmap: RoadmapData) => void | Promise<void>;
}

type Phase = "progress" | "preview";

function Content({
	args,
	onClose,
}: {
	args: DevRoadmapGenerateModalArgs;
	onClose: () => void;
}) {
	const [phase, setPhase] = useState<Phase>("progress");
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);

	// 5단계 애니메이션: 각 단계 ~1000ms
	useEffect(() => {
		if (phase !== "progress") return;
		let cancelled = false;

		const run = async () => {
			for (let i = 0; i < DEV_ROADMAP_STEPS.length; i++) {
				if (cancelled) return;
				setCurrentStepIndex(i);
				await sleep(1000);
			}
			if (cancelled) return;
			// 최종 계산은 즉시 (순수 함수)
			const result = generateDevelopmentRoadmap({
				report: args.report,
				meetings: args.meetings,
				members: args.members,
				planningEndIso: args.planningEndIso,
			});
			setRoadmap(result);
			setPhase("preview");
		};

		void run();
		return () => {
			cancelled = true;
		};
	}, [phase, args]);

	const regenerate = () => {
		setRoadmap(null);
		setCurrentStepIndex(0);
		setPhase("progress");
	};

	const approve = async () => {
		if (!roadmap) return;
		await args.onApprove(roadmap);
		onClose();
	};

	if (phase === "progress") {
		return (
			<ModalLayout
				title="⚙️ 개발 로드맵 생성 중"
				description="AI가 회의록을 분석하고 있습니다..."
				onCancel={onClose}
				widthClass="max-w-xl"
			>
				<ProgressList currentIndex={currentStepIndex} />
				<p className="mt-4 text-[11px] text-text-faint">
					나중에 실제 AI·서버가 붙으면 이 시뮬레이션 자리가 llmClient 호출로
					교체됩니다.
				</p>
			</ModalLayout>
		);
	}

	// preview
	return (
		<ModalLayout
			title="🗺️ 생성된 개발 로드맵 미리보기"
			description="AI가 회의록 기반으로 생성한 초안입니다. 승인하면 개발 로드맵 탭에 반영됩니다."
			onCancel={onClose}
			widthClass="max-w-3xl"
		>
			{roadmap && <PreviewBody roadmap={roadmap} meetings={args.meetings} />}
			<footer className="mt-6 flex items-center justify-end gap-2 border-t border-bg-modifier pt-3">
				<Button variant="ghost" onClick={onClose}>
					취소
				</Button>
				<Button variant="outline" onClick={regenerate}>
					<RefreshCw className="h-3.5 w-3.5" />
					다시 생성
				</Button>
				<Button onClick={() => void approve()}>
					<CheckCircle2 className="h-3.5 w-3.5" />
					승인 · 로드맵 반영
				</Button>
			</footer>
		</ModalLayout>
	);
}

function ProgressList({ currentIndex }: { currentIndex: number }) {
	return (
		<ul className="space-y-2">
			{DEV_ROADMAP_STEPS.map((step, i) => {
				const state =
					i < currentIndex
						? "done"
						: i === currentIndex
							? "active"
							: "pending";
				return (
					<li
						key={step.key}
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
							{i + 1}/{DEV_ROADMAP_STEPS.length} {step.label}
						</span>
					</li>
				);
			})}
		</ul>
	);
}

function StepIcon({
	state,
}: {
	state: "done" | "active" | "pending";
}) {
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
	roadmap,
	meetings,
}: {
	roadmap: RoadmapData;
	meetings: MeetingPageData[];
}) {
	const meetingTitleById = useMemo(() => {
		const m = new Map<string, string>();
		for (const meet of meetings) m.set(meet.id, meet.title);
		return m;
	}, [meetings]);

	const tasksOnly = roadmap.tasks.filter((t) => t.kind === "task");

	return (
		<div className="space-y-4">
			<div className="rounded-md border border-[color:var(--interactive-accent)]/30 bg-[color:var(--interactive-accent)]/5 p-3">
				<p className="flex items-center gap-2 text-xs font-semibold text-[color:var(--interactive-accent)]">
					<Sparkles className="h-3.5 w-3.5" />
					AI가 회의록 {meetings.length}건에서 {tasksOnly.length}개 Task를 생성했습니다
				</p>
				<p className="mt-1 text-[11px] text-text-muted">
					담당자 배정은 팀원 기술스택 매칭 기반이며, 승인 후에도 개별 수정
					가능합니다.
				</p>
			</div>

			<div>
				<h3 className="mb-2 text-sm font-semibold text-text-normal">
					📋 생성된 Task ({tasksOnly.length}개)
				</h3>
				<div className="max-h-[320px] overflow-y-auto rounded-md border border-bg-modifier">
					<table className="w-full text-xs">
						<thead className="sticky top-0 bg-bg-secondary">
							<tr className="border-b border-bg-modifier text-left text-text-muted">
								<th className="px-3 py-2 font-medium">Task</th>
								<th className="px-3 py-2 font-medium">담당자</th>
								<th className="px-3 py-2 font-medium">일정</th>
								<th className="px-3 py-2 font-medium">출처 회의</th>
							</tr>
						</thead>
						<tbody>
							{tasksOnly.map((t, i) => (
								<tr
									key={t.id}
									className={cn(
										"border-b border-bg-modifier/60",
										i % 2 === 1 && "bg-bg-secondary/40",
									)}
								>
									<td className="px-3 py-2 align-top text-text-normal">
										{t.name}
									</td>
									<td className="px-3 py-2 align-top text-text-muted">
										{t.assignee ?? "미배정"}
									</td>
									<td className="px-3 py-2 align-top font-mono text-[10px] text-text-faint">
										{t.start.slice(5)} ~ {t.end.slice(5)}
									</td>
									<td className="px-3 py-2 align-top text-[10px] text-text-faint">
										{(t.sourceMeetings ?? []).map((mid, j) => (
											<span
												key={mid}
												className="mr-1 inline-block rounded bg-bg-modifier px-1.5 py-0.5"
												title={mid}
											>
												{meetingTitleById.get(mid) ?? mid}
												{j < (t.sourceMeetings?.length ?? 0) - 1 ? "" : ""}
											</span>
										))}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div>
				<h3 className="mb-2 text-sm font-semibold text-text-normal">
					📐 단계 구분 ({roadmap.phases.length}개)
				</h3>
				<div className="flex flex-wrap gap-2">
					{roadmap.phases.map((p) => (
						<span
							key={p.id}
							className="inline-flex items-center gap-1.5 rounded-full border border-bg-modifier bg-bg-secondary px-2.5 py-1 text-[11px] text-text-muted"
						>
							<span
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: p.color }}
							/>
							{p.name}
							<span className="text-text-faint">
								{p.start.slice(5)}~{p.end.slice(5)}
							</span>
						</span>
					))}
				</div>
			</div>
		</div>
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ───────────────────────── Export class ─────────────────────────

export class DevRoadmapGenerateModal extends BaseReactModal {
	constructor(
		app: App,
		private readonly args: DevRoadmapGenerateModalArgs,
	) {
		super(app);
	}

	renderContent() {
		return <Content args={this.args} onClose={() => this.close()} />;
	}
}
