/**
 * RoadmapView — 로드맵 뷰.
 *
 * 순수 프레젠테이션 컴포넌트. 데이터는 props(`data`)로만 받는다.
 *
 * 두 가지 시각화 모드를 탭으로 전환:
 *   1) 흐름 (Flow) — 프로젝트가 어떤 단계로 굴러가는지 보여주는 phase-level 뷰
 *   2) 간트 (Gantt) — 작업별 시작·종료 날짜가 보이는 상세 타임라인
 *
 * 오늘: `RoadmapItemView`가 `mockRoadmapData`를 주입.
 * 미래: 같은 ItemView가 `roadmapService.generate(...)` 결과를 주입. 이 파일은 무변경.
 */

import { useMemo, useState } from "react";
import {
	Code2,
	Compass,
	FlaskConical,
	Rocket,
	Server,
	type LucideIcon,
} from "lucide-react";
import { BackNav, type BackNavItem } from "shared/ui/BackNav";
import { Button } from "shared/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "shared/ui/Card";
import { cn } from "shared/ui/utils";
import type {
	PhaseIconName,
	RoadmapData,
	RoadmapPhase,
	RoadmapProjectInfo,
	RoadmapTask,
	TaskStatus,
} from "../domain/roadmapData";

// ───────────────────────── Icon Mapping ─────────────────────────

const PHASE_ICON: Record<PhaseIconName, LucideIcon> = {
	compass: Compass,
	code: Code2,
	server: Server,
	flask: FlaskConical,
	rocket: Rocket,
};

// ───────────────────────── Helpers ─────────────────────────

const toDate = (iso: string): Date => new Date(iso + "T00:00:00");
const diffDays = (a: Date, b: Date): number =>
	Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

// ───────────────────────── Component ─────────────────────────

type Mode = "flow" | "gantt";
type RoadmapKind = "planning" | "development";

export interface RoadmapViewProps {
	/** 기획 로드맵 — 항상 전달됨 (이 View가 렌더되는 시점엔 PO-1 완료). */
	planning: RoadmapData;
	/** 개발 로드맵 — PO-6 미완료면 null. */
	development: RoadmapData | null;
	/** 개발 로드맵 미생성 시 개발 탭에서 "생성" 버튼 눌렀을 때. */
	onGenerateDevelopment?: () => void;
	/**
	 * 테스트 전용 개발 로드맵 삭제 핸들러.
	 * 제공되면 개발 탭 상단에 "🗑️ 로드맵 삭제" 배너가 표시됨.
	 * 프로덕션(v2) 에서는 제공 X.
	 */
	onDeleteDevelopment?: () => void;
	/** "AI 재생성" 버튼 클릭 핸들러. */
	onRegenerate?: () => void;
	onBackToHome?: () => void;
}

export function RoadmapView({
	planning,
	development,
	onGenerateDevelopment,
	onDeleteDevelopment,
	onRegenerate,
	onBackToHome,
}: RoadmapViewProps) {
	// 개발 로드맵이 있으면 기본 선택을 개발, 없으면 기획
	const [kind, setKind] = useState<RoadmapKind>(
		development !== null ? "development" : "planning",
	);
	const [mode, setMode] = useState<Mode>("flow");

	const navItems: BackNavItem[] = [];
	if (onBackToHome)
		navItems.push({ icon: "home", label: "홈으로", onClick: onBackToHome });

	// 선택된 탭의 data
	const activeData: RoadmapData | null =
		kind === "planning" ? planning : development;

	return (
		<div className="pharos-root min-h-full w-full overflow-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-6xl space-y-6">
				{navItems.length > 0 && <BackNav items={navItems} />}
				<Header
					project={planning.project}
					mode={mode}
					onModeChange={setMode}
					onRegenerate={onRegenerate}
				/>

				<KindTabs
					kind={kind}
					onKindChange={setKind}
					developmentUnlocked={development !== null}
				/>

				{kind === "development" &&
					development !== null &&
					onDeleteDevelopment && (
						<DevRoadmapTestBanner onDelete={onDeleteDevelopment} />
					)}

				{activeData ? (
					mode === "flow" ? (
						<FlowView project={activeData.project} phases={activeData.phases} />
					) : (
						<GanttViewInline
							project={activeData.project}
							tasks={activeData.tasks}
						/>
					)
				) : (
					<DevelopmentLocked onGenerate={onGenerateDevelopment} />
				)}
			</div>
		</div>
	);
}

/**
 * 개발 로드맵 탭 상단 "테스트 전용 · 로드맵 삭제" 배너.
 * 시연용으로 생성된 개발 로드맵을 빠르게 제거해 🔒 상태로 돌아가게 함.
 * 프로덕션(v2) 에서는 렌더되지 않음 (onDeleteDevelopment prop 없으면 숨김).
 */
function DevRoadmapTestBanner({ onDelete }: { onDelete: () => void }) {
	const handleClick = () => {
		const ok = window.confirm(
			"개발 로드맵을 삭제하시겠습니까?\n\n" +
				"• 생성된 로드맵 데이터가 사라지고 🔒 잠금 상태로 돌아갑니다.\n" +
				"• 기획 로드맵은 영향을 받지 않습니다.\n" +
				"• 시연·테스트 목적으로만 사용하세요.",
		);
		if (ok) onDelete();
	};
	return (
		<div className="flex items-center justify-between rounded-md border border-dashed border-[color:var(--color-orange)]/50 bg-[color:var(--color-orange)]/5 px-3 py-2 text-xs">
			<span className="text-text-muted">
				🧪 <span className="font-semibold">테스트 전용</span> · 개발 로드맵을 리셋해 생성 화면으로 되돌립니다
			</span>
			<Button
				variant="outline"
				size="sm"
				onClick={handleClick}
				className="border-[color:var(--color-red)]/50 text-[color:var(--color-red)] hover:bg-[color:var(--color-red)]/10"
			>
				🗑️ 로드맵 삭제
			</Button>
		</div>
	);
}

/** 기획 / 개발 탭 네비게이션. */
function KindTabs({
	kind,
	onKindChange,
	developmentUnlocked,
}: {
	kind: RoadmapKind;
	onKindChange: (k: RoadmapKind) => void;
	developmentUnlocked: boolean;
}) {
	return (
		<div className="inline-flex rounded-md border border-bg-modifier bg-bg-secondary p-1">
			<KindButton
				active={kind === "planning"}
				label="🎯 기획 로드맵"
				onClick={() => onKindChange("planning")}
			/>
			<KindButton
				active={kind === "development"}
				label={developmentUnlocked ? "💻 개발 로드맵" : "🔒 개발 로드맵"}
				onClick={() => onKindChange("development")}
			/>
		</div>
	);
}

function KindButton({
	active,
	label,
	onClick,
	disabled,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
	disabled?: boolean;
}) {
	const handle = () => {
		if (!disabled) onClick();
	};
	return (
		<div
			onClick={handle}
			role="button"
			tabIndex={disabled ? -1 : 0}
			onKeyDown={(e) => {
				if (!disabled && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					handle();
				}
			}}
			className={cn(
				"rounded px-4 py-1.5 text-xs font-medium transition-colors",
				disabled
					? "cursor-not-allowed text-text-faint"
					: active
						? "cursor-pointer bg-[color:var(--interactive-accent)] text-[color:var(--text-on-accent)]"
						: "cursor-pointer text-text-muted hover:text-text-normal",
			)}
		>
			{label}
		</div>
	);
}

/** 개발 탭 선택했는데 아직 생성 안 됐을 때 표시. */
function DevelopmentLocked({ onGenerate }: { onGenerate?: () => void }) {
	return (
		<Card>
			<CardContent className="flex flex-col items-center gap-3 py-12 text-center">
				<p className="text-sm text-text-muted">
					🔒 개발 로드맵이 아직 생성되지 않았습니다
				</p>
				<p className="max-w-md text-xs text-text-faint">
					기획 주간이 마무리되면 "개발 단계로 전환" 버튼을 눌러 AI가 팀원
					기술스택 기반으로 Task를 자동 할당하도록 할 수 있어요.
				</p>
				{onGenerate && (
					<Button onClick={onGenerate} className="mt-2">
						🔄 개발 단계로 전환하기
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

function Header({
	project,
	mode,
	onModeChange,
	onRegenerate,
}: {
	project: RoadmapProjectInfo;
	mode: Mode;
	onModeChange: (m: Mode) => void;
	onRegenerate?: () => void;
}) {
	return (
		<header className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-text-normal">
						Pharos Roadmap
					</h1>
					<p className="mt-1 text-xs text-text-muted">
						{project.start} ~ {project.end}
					</p>
				</div>
				{onRegenerate && (
					<Button variant="secondary" size="sm" onClick={onRegenerate}>
						AI 재생성
					</Button>
				)}
			</div>

			<div className="inline-flex rounded-md border border-bg-modifier bg-bg-secondary p-1">
				<ModeButton
					active={mode === "flow"}
					onClick={() => onModeChange("flow")}
					label="흐름"
					hint="큰 단계만"
				/>
				<ModeButton
					active={mode === "gantt"}
					onClick={() => onModeChange("gantt")}
					label="간트 차트"
					hint="세부 일정"
				/>
			</div>
		</header>
	);
}

function ModeButton({
	active,
	onClick,
	label,
	hint,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
	hint: string;
}) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"rounded px-4 py-1.5 text-xs font-medium transition-colors",
				active
					? "bg-[color:var(--interactive-accent)] text-[color:var(--text-on-accent)]"
					: "text-text-muted hover:text-text-normal",
			)}
		>
			{label}
			<span className="ml-2 opacity-60">{hint}</span>
		</button>
	);
}

// ───────────────────────── Flow (Phase) View ─────────────────────────

function FlowView({
	project,
	phases,
}: {
	project: RoadmapProjectInfo;
	phases: RoadmapPhase[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>📌 프로젝트 흐름</CardTitle>
				<CardDescription>
					전체 프로젝트가 어떤 스텝으로 굴러가는지 한눈에
				</CardDescription>
			</CardHeader>
			<CardContent className="pb-8">
				<ArrowChain phases={phases} />
				<TimelineRuler projectStart={project.start} projectEnd={project.end} />
				<StepDetails phases={phases} />
			</CardContent>
		</Card>
	);
}

function ArrowChain({ phases }: { phases: RoadmapPhase[] }) {
	return (
		<div className="mb-8 flex items-stretch">
			{phases.map((phase, i) => (
				<ArrowBlock
					key={phase.id}
					phase={phase}
					isFirst={i === 0}
					isLast={i === phases.length - 1}
				/>
			))}
		</div>
	);
}

function ArrowBlock({
	phase,
	isFirst,
	isLast,
}: {
	phase: RoadmapPhase;
	isFirst: boolean;
	isLast: boolean;
}) {
	const Icon = PHASE_ICON[phase.icon];

	const opacity =
		phase.status === "done"
			? 1
			: phase.status === "in-progress"
				? 1
				: 0.4;

	const notchWidth = 18;
	const clipPath = isFirst
		? `polygon(0 0, calc(100% - ${notchWidth}px) 0, 100% 50%, calc(100% - ${notchWidth}px) 100%, 0 100%)`
		: `polygon(0 0, calc(100% - ${notchWidth}px) 0, 100% 50%, calc(100% - ${notchWidth}px) 100%, 0 100%, ${notchWidth}px 50%)`;

	return (
		<div className="relative flex flex-1 flex-col items-center">
			<div
				className="mb-2 flex h-10 w-10 items-center justify-center rounded-full"
				style={{ color: phase.color, opacity }}
			>
				<Icon className="h-7 w-7" strokeWidth={2.5} />
			</div>

			<div
				className={cn(
					"relative flex h-14 w-full items-center justify-center px-4 text-center font-bold text-white shadow-sm",
					isLast ? "" : "-mr-4",
				)}
				style={{
					background: `linear-gradient(135deg, ${phase.color}ee, ${phase.color}aa)`,
					clipPath,
					opacity,
				}}
			>
				<span className="truncate text-sm tracking-wide">{phase.name}</span>
			</div>
		</div>
	);
}

function TimelineRuler({
	projectStart,
	projectEnd,
}: {
	projectStart: string;
	projectEnd: string;
}) {
	const start = toDate(projectStart);
	const end = toDate(projectEnd);
	const totalDays = diffDays(start, end);

	const monthMarkers = useMemo(() => {
		const markers: { label: string; offset: number }[] = [];
		const cur = new Date(start);
		cur.setDate(1);
		while (cur <= end) {
			markers.push({
				label: `${cur.getFullYear()}.${cur.getMonth() + 1}`,
				offset: Math.max(0, diffDays(start, cur)),
			});
			cur.setMonth(cur.getMonth() + 1);
		}
		markers.push({
			label: `${cur.getFullYear()}.${cur.getMonth() + 1}`,
			offset: totalDays,
		});
		return markers;
	}, [start, end, totalDays]);

	return (
		<div className="relative mx-6 my-4 h-14">
			<div className="absolute top-1/2 left-0 right-0 h-px bg-bg-modifier" />

			{monthMarkers.map((m, i) => {
				const pct = (m.offset / totalDays) * 100;
				const above = i % 2 === 0;
				return (
					<div
						key={i}
						className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
						style={{ left: `${pct}%` }}
					>
						<div className="flex flex-col items-center">
							{above && (
								<div className="absolute bottom-3 text-xs font-medium text-text-muted whitespace-nowrap">
									{m.label}
								</div>
							)}
							<div className="h-3 w-px bg-text-faint" />
							{!above && (
								<div className="absolute top-3 text-xs font-medium text-text-muted whitespace-nowrap">
									{m.label}
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

function StepDetails({ phases }: { phases: RoadmapPhase[] }) {
	return (
		<div className="relative">
			<div className="absolute left-[10%] right-[10%] top-3 h-px bg-bg-modifier" />

			<div
				className="grid gap-4"
				style={{ gridTemplateColumns: `repeat(${phases.length}, 1fr)` }}
			>
				{phases.map((phase, i) => (
					<StepColumn key={phase.id} phase={phase} index={i} />
				))}
			</div>
		</div>
	);
}

function StepColumn({ phase, index }: { phase: RoadmapPhase; index: number }) {
	const statusLabel = {
		done: "완료",
		"in-progress": "진행 중",
		todo: "예정",
	}[phase.status];

	return (
		<div className="flex flex-col items-center px-2">
			<div
				className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-4 ring-bg-secondary"
				style={{ backgroundColor: phase.color }}
			>
				{index + 1}
			</div>

			<div className="mt-3 text-center">
				<p className="text-xs font-semibold text-text-normal">Step {index + 1}</p>
				<p className="mt-0.5 text-[10px] text-text-faint">
					{phase.start.slice(5)} ~ {phase.end.slice(5)}
				</p>
				<span
					className="mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium"
					style={{
						backgroundColor: phase.color + "22",
						color: phase.color,
					}}
				>
					{statusLabel}
				</span>
			</div>

			<ul className="mt-3 space-y-1 text-left text-[11px] text-text-muted">
				{phase.activities.map((a, i) => (
					<li key={i} className="flex gap-1.5">
						<span className="text-text-faint">•</span>
						<span className="flex-1">{a}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

// ───────────────────────── Gantt (Detailed) View ─────────────────────────

function GanttViewInline({
	project,
	tasks,
}: {
	project: RoadmapProjectInfo;
	tasks: RoadmapTask[];
}) {
	const projectStart = toDate(project.start);
	const projectEnd = toDate(project.end);
	const totalDays = diffDays(projectStart, projectEnd) + 1;

	const [dayWidth, setDayWidth] = useState<number>(20);

	const dateHeaders = useMemo(() => {
		const dates: Date[] = [];
		for (let i = 0; i < totalDays; i++) {
			const d = new Date(projectStart);
			d.setDate(d.getDate() + i);
			dates.push(d);
		}
		return dates;
	}, [projectStart, totalDays]);

	const today = toDate(new Date().toISOString().slice(0, 10));
	const todayOffset = diffDays(projectStart, today);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>📅 세부 간트 차트</CardTitle>
						<CardDescription>
							각 작업의 시작·종료 날짜와 진척도
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-xs text-text-muted">줌:</span>
						<Button
							variant={dayWidth === 14 ? "default" : "secondary"}
							size="sm"
							onClick={() => setDayWidth(14)}
						>
							작게
						</Button>
						<Button
							variant={dayWidth === 20 ? "default" : "secondary"}
							size="sm"
							onClick={() => setDayWidth(20)}
						>
							보통
						</Button>
						<Button
							variant={dayWidth === 32 ? "default" : "secondary"}
							size="sm"
							onClick={() => setDayWidth(32)}
						>
							크게
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<GanttChart
					tasks={tasks}
					projectStart={projectStart}
					totalDays={totalDays}
					dayWidth={dayWidth}
					todayOffset={todayOffset}
					dateHeaders={dateHeaders}
				/>

				<div className="mt-4 flex flex-wrap gap-4 text-xs text-text-muted">
					<LegendItem color="bg-[color:var(--color-green)]" label="완료" />
					<LegendItem color="bg-[color:var(--color-orange)]" label="진행 중" />
					<LegendItem color="bg-bg-modifier" label="예정" />
					<LegendItem
						color="bg-[color:var(--interactive-accent)]"
						label="마일스톤"
						shape="diamond"
					/>
				</div>
			</CardContent>
		</Card>
	);
}

function LegendItem({
	color,
	label,
	shape = "bar",
}: {
	color: string;
	label: string;
	shape?: "bar" | "diamond";
}) {
	return (
		<div className="flex items-center gap-2">
			{shape === "bar" ? (
				<div className={cn("h-3 w-8 rounded-sm", color)} />
			) : (
				<div className={cn("h-3 w-3 rotate-45", color)} />
			)}
			<span>{label}</span>
		</div>
	);
}

interface GanttChartProps {
	tasks: RoadmapTask[];
	projectStart: Date;
	totalDays: number;
	dayWidth: number;
	todayOffset: number;
	dateHeaders: Date[];
}

function GanttChart({
	tasks,
	projectStart,
	totalDays,
	dayWidth,
	todayOffset,
	dateHeaders,
}: GanttChartProps) {
	const chartWidth = totalDays * dayWidth;
	const rowHeight = 36;
	const labelWidth = 320;

	return (
		<div className="relative overflow-x-auto">
			<div style={{ minWidth: labelWidth + chartWidth }}>
				<div className="flex sticky top-0 z-10 bg-bg-secondary border-b border-bg-modifier">
					<div
						className="shrink-0 flex items-center px-3 text-xs font-semibold text-text-muted"
						style={{ width: labelWidth }}
					>
						작업명
					</div>
					<div className="flex" style={{ width: chartWidth }}>
						{dateHeaders.map((d, i) => {
							const isWeekend = d.getDay() === 0 || d.getDay() === 6;
							const isToday = i === todayOffset;
							const isFirstOfMonth = d.getDate() === 1;
							return (
								<div
									key={i}
									className={cn(
										"shrink-0 border-l border-bg-modifier py-2 text-center text-[10px]",
										isWeekend && "bg-bg-modifier/30 text-text-faint",
										isToday &&
											"bg-[color:var(--interactive-accent)]/10 font-bold text-[color:var(--interactive-accent)]",
										isFirstOfMonth && "border-l-2 border-l-bg-modifier",
									)}
									style={{ width: dayWidth }}
								>
									<div>
										{d.getMonth() + 1}/{d.getDate()}
									</div>
								</div>
							);
						})}
					</div>
				</div>

				<div className="relative">
					{todayOffset >= 0 && todayOffset < totalDays && (
						<div
							className="absolute top-0 bottom-0 w-px bg-[color:var(--interactive-accent)] opacity-50 z-0"
							style={{
								left: labelWidth + todayOffset * dayWidth + dayWidth / 2,
							}}
						/>
					)}

					{tasks.map((task) => (
						<GanttRow
							key={task.id}
							task={task}
							projectStart={projectStart}
							dayWidth={dayWidth}
							rowHeight={rowHeight}
							labelWidth={labelWidth}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

function GanttRow({
	task,
	projectStart,
	dayWidth,
	rowHeight,
	labelWidth,
}: {
	task: RoadmapTask;
	projectStart: Date;
	dayWidth: number;
	rowHeight: number;
	labelWidth: number;
}) {
	const start = toDate(task.start);
	const end = toDate(task.end);
	const startOffset = diffDays(projectStart, start);
	const duration = Math.max(1, diffDays(start, end) + 1);

	const left = startOffset * dayWidth;
	const width = duration * dayWidth;

	const statusBg: Record<TaskStatus, string> = {
		done: "bg-[color:var(--color-green)]",
		"in-progress": "bg-[color:var(--color-orange)]",
		todo: "bg-bg-modifier",
	};

	const progressBg: Record<TaskStatus, string> = {
		done: "bg-[color:var(--color-green)]/60",
		"in-progress": "bg-[color:var(--color-orange)]/60",
		todo: "bg-bg-modifier",
	};

	return (
		<div
			className="flex border-b border-bg-modifier hover:bg-[color:var(--background-modifier-hover)]"
			style={{ height: rowHeight }}
		>
			<div
				className="shrink-0 flex items-center gap-2 px-3 text-xs"
				style={{ width: labelWidth }}
			>
				{task.kind === "milestone" ? (
					<span className="text-[color:var(--interactive-accent)]">◆</span>
				) : (
					<span className="h-2 w-2 rounded-full bg-bg-modifier" />
				)}
				<div className="flex-1 min-w-0 truncate">
					<span className="text-text-normal font-medium">{task.name}</span>
					{task.assignee && (
						<span className="ml-2 text-[10px] font-normal text-text-faint">
							@{task.assignee}
						</span>
					)}
				</div>
			</div>

			<div className="relative" style={{ flex: 1 }}>
				{task.kind === "milestone" ? (
					<div
						className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rotate-45 bg-[color:var(--interactive-accent)]"
						style={{ left: left - 8 + dayWidth / 2 }}
						title={`${task.name} · ${task.start}`}
					/>
				) : (
					<div
						className={cn(
							"absolute top-1/2 -translate-y-1/2 h-5 overflow-hidden rounded shadow-sm",
							statusBg[task.status],
						)}
						style={{ left, width }}
						title={`${task.name} · ${task.start} ~ ${task.end} · ${task.progress}%`}
					>
						<div
							className={cn("h-full", progressBg[task.status])}
							style={{ width: `${task.progress}%` }}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
