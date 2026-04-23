/**
 * RoadmapView — 로드맵 뷰 (MOCKUP).
 *
 * 두 가지 시각화 모드를 탭으로 전환:
 *   1) 흐름 (Flow) — 프로젝트가 어떤 단계로 굴러가는지 한눈에 보여주는 phase-level 뷰
 *   2) 간트 (Gantt) — 작업별 시작·종료 날짜가 보이는 상세 타임라인
 *
 * Pharos 스스로를 프로젝트로 가정한 가짜 데이터. 실제 구현에서는 PO-1(기획 로드맵 생성)이
 * 만든 Task 목록을 여기에 연결한다.
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
import { Button } from "shared/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "shared/ui/Card";
import { cn } from "shared/ui/utils";

// ───────────────────────── Types ─────────────────────────

type TaskKind = "task" | "milestone";
type TaskStatus = "done" | "in-progress" | "todo";

interface RoadmapTask {
	id: string;
	name: string;
	kind: TaskKind;
	status: TaskStatus;
	start: string;
	end: string;
	progress: number;
	assignee?: string;
	dependsOn?: string[];
}

interface RoadmapPhase {
	id: string;
	name: string;
	start: string;
	end: string;
	status: TaskStatus;
	activities: string[];
	icon: LucideIcon;
	/** 화살표 블록의 메인 색상 (HEX). */
	color: string;
}

// ───────────────────────── Mock Data ─────────────────────────

const mockProject = {
	name: "Pharos — AI 프로젝트 매니저 플러그인",
	start: "2026-04-01",
	end: "2026-06-30",
};

// 큰 단계(흐름)
const mockPhases: RoadmapPhase[] = [
	{
		id: "phase-plan",
		name: "기획 및 설계",
		start: "2026-04-01",
		end: "2026-04-25",
		status: "done",
		icon: Compass,
		color: "#f97316", // orange
		activities: [
			"주제 구체화 · 문제 정의",
			"유스케이스 17개 정의",
			"환경 시나리오 12개",
			"아키텍처 · 기술스택 확정",
			"UI/UX 레이아웃 설계",
		],
	},
	{
		id: "phase-mvp",
		name: "MVP 기능 개발",
		start: "2026-04-25",
		end: "2026-05-31",
		status: "in-progress",
		icon: Code2,
		color: "#3b82f6", // blue
		activities: [
			"프로젝트 생성 (PO-0)",
			"기획 · 개발 로드맵 (PO-1/6)",
			"회의 주제 · 자료 (PO-2/3)",
			"회의록 분석 (PO-5)",
			"체크리스트 · 진척도 (PO-11/12)",
		],
	},
	{
		id: "phase-integration",
		name: "서버 · AI 연동",
		start: "2026-05-15",
		end: "2026-06-15",
		status: "todo",
		icon: Server,
		color: "#8b5cf6", // violet
		activities: [
			"Hocuspocus 서버 연결",
			"JWT 인증 구현",
			"OpenAI 연동",
			"GitHub REST API 연동",
		],
	},
	{
		id: "phase-test",
		name: "통합 테스트 · 논문",
		start: "2026-06-10",
		end: "2026-06-25",
		status: "todo",
		icon: FlaskConical,
		color: "#ec4899", // pink
		activities: [
			"통합 테스트",
			"사용자 테스트",
			"논문 작성",
		],
	},
	{
		id: "phase-release",
		name: "최종 발표 · 배포",
		start: "2026-06-25",
		end: "2026-06-30",
		status: "todo",
		icon: Rocket,
		color: "#10b981", // emerald
		activities: [
			"시연 영상 제작",
			"최종 발표 준비",
			"GitHub Release",
		],
	},
];

// 세부 작업(간트)
const mockTasks: RoadmapTask[] = [
	{
		id: "mile-kickoff",
		name: "프로젝트 킥오프",
		kind: "milestone",
		status: "done",
		start: "2026-04-01",
		end: "2026-04-01",
		progress: 100,
	},
	{
		id: "task-topic",
		name: "주제 구체화",
		kind: "task",
		status: "done",
		start: "2026-04-01",
		end: "2026-04-03",
		progress: 100,
		assignee: "유석",
	},
	{
		id: "task-problem",
		name: "문제 정의",
		kind: "task",
		status: "done",
		start: "2026-04-03",
		end: "2026-04-05",
		progress: 100,
		assignee: "유석",
	},
	{
		id: "task-uc",
		name: "유스케이스 정의 (PO-0 ~ PM-4)",
		kind: "task",
		status: "done",
		start: "2026-04-05",
		end: "2026-04-15",
		progress: 100,
		assignee: "유석",
	},
	{
		id: "task-scenario",
		name: "환경 시나리오 작성",
		kind: "task",
		status: "done",
		start: "2026-04-10",
		end: "2026-04-18",
		progress: 100,
		assignee: "유석",
	},
	{
		id: "task-stack",
		name: "기술 스택 조사 · 확정",
		kind: "task",
		status: "done",
		start: "2026-04-08",
		end: "2026-04-20",
		progress: 100,
		assignee: "경석",
	},
	{
		id: "task-arch",
		name: "아키텍처 설계",
		kind: "task",
		status: "done",
		start: "2026-04-20",
		end: "2026-04-22",
		progress: 100,
		assignee: "유석",
	},
	{
		id: "task-ux",
		name: "UI/UX 레이아웃 설계",
		kind: "task",
		status: "in-progress",
		start: "2026-04-22",
		end: "2026-04-25",
		progress: 60,
		assignee: "유석 + 우덕",
	},
	{
		id: "task-mvp",
		name: "MVP 범위 확정 (시나리오 1~4)",
		kind: "task",
		status: "done",
		start: "2026-04-20",
		end: "2026-04-23",
		progress: 100,
		assignee: "유석",
	},
	{
		id: "mile-dev-start",
		name: "개발 로드맵 전환",
		kind: "milestone",
		status: "todo",
		start: "2026-04-25",
		end: "2026-04-25",
		progress: 0,
	},
];

// ───────────────────────── Helpers ─────────────────────────

const toDate = (iso: string): Date => new Date(iso + "T00:00:00");
const diffDays = (a: Date, b: Date): number =>
	Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

// ───────────────────────── Component ─────────────────────────

type Mode = "flow" | "gantt";

export function RoadmapView() {
	const [mode, setMode] = useState<Mode>("flow");

	return (
		<div className="pharos-root min-h-full w-full overflow-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-6xl space-y-6">
				<Header project={mockProject} mode={mode} onModeChange={setMode} />

				{mode === "flow" ? <FlowView /> : <GanttViewInline />}
			</div>
		</div>
	);
}

function Header({
	project,
	mode,
	onModeChange,
}: {
	project: typeof mockProject;
	mode: Mode;
	onModeChange: (m: Mode) => void;
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
				<Button variant="secondary" size="sm">
					AI 재생성
				</Button>
			</div>

			{/* 모드 토글 */}
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

function FlowView() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>📌 프로젝트 흐름</CardTitle>
				<CardDescription>
					전체 프로젝트가 어떤 스텝으로 굴러가는지 한눈에
				</CardDescription>
			</CardHeader>
			<CardContent className="pb-8">
				<ArrowChain phases={mockPhases} />
				<TimelineRuler
					projectStart={mockProject.start}
					projectEnd={mockProject.end}
				/>
				<StepDetails phases={mockPhases} />
			</CardContent>
		</Card>
	);
}

/**
 * 월 단위 마커가 타임라인 위/아래 번갈아 표시되는 시간 눈금.
 * 가로선에 tick mark 가 월 경계마다 찍힌다.
 */
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
		// 시작 월부터 끝 월 다음 달까지
		const cur = new Date(start);
		cur.setDate(1);
		while (cur <= end) {
			markers.push({
				label: `${cur.getFullYear()}.${cur.getMonth() + 1}`,
				offset: Math.max(0, diffDays(start, cur)),
			});
			cur.setMonth(cur.getMonth() + 1);
		}
		// 끝 월 다음 마커 하나 더 (타임라인 끝점 표시)
		markers.push({
			label: `${cur.getFullYear()}.${cur.getMonth() + 1}`,
			offset: totalDays,
		});
		return markers;
	}, [start, end, totalDays]);

	return (
		<div className="relative mx-6 my-4 h-14">
			{/* 가로 타임라인 */}
			<div className="absolute top-1/2 left-0 right-0 h-px bg-bg-modifier" />

			{/* 월 마커 */}
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
							{/* 위쪽 라벨 */}
							{above && (
								<div className="absolute bottom-3 text-xs font-medium text-text-muted whitespace-nowrap">
									{m.label}
								</div>
							)}
							{/* tick mark */}
							<div className="h-3 w-px bg-text-faint" />
							{/* 아래쪽 라벨 */}
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

/**
 * 화살표 체인 — 각 phase가 균등 폭으로 오른쪽으로 이어지는 모양.
 * 첫 블록은 왼쪽이 평평하고, 나머지는 왼쪽에 화살표 꼬리가 들어간다.
 */
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
	const Icon = phase.icon;

	// 상태별 색상 투명도 조정
	const opacity =
		phase.status === "done"
			? 1
			: phase.status === "in-progress"
				? 1
				: 0.4;

	// 화살표 모양 (clip-path). 첫 블록은 왼쪽 notch 없음.
	const notchWidth = 18;
	const clipPath = isFirst
		? `polygon(0 0, calc(100% - ${notchWidth}px) 0, 100% 50%, calc(100% - ${notchWidth}px) 100%, 0 100%)`
		: `polygon(0 0, calc(100% - ${notchWidth}px) 0, 100% 50%, calc(100% - ${notchWidth}px) 100%, 0 100%, ${notchWidth}px 50%)`;

	return (
		<div className="relative flex flex-1 flex-col items-center">
			{/* 상단 아이콘 */}
			<div
				className="mb-2 flex h-10 w-10 items-center justify-center rounded-full"
				style={{
					color: phase.color,
					opacity,
				}}
			>
				<Icon className="h-7 w-7" strokeWidth={2.5} />
			</div>

			{/* 화살표 블록 */}
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

/**
 * 스텝별 상세 — 각 phase 아래 위치.
 * 타임라인 + 숫자 원 + Step N 라벨 + 활동 bullet 목록.
 */
function StepDetails({ phases }: { phases: RoadmapPhase[] }) {
	return (
		<div className="relative">
			{/* 가로 타임라인 */}
			<div className="absolute left-[10%] right-[10%] top-3 h-px bg-bg-modifier" />

			<div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${phases.length}, 1fr)` }}>
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
			{/* 타임라인 위의 숫자 원 */}
			<div
				className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-4 ring-bg-secondary"
				style={{ backgroundColor: phase.color }}
			>
				{index + 1}
			</div>

			{/* Step N 라벨 */}
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

			{/* 활동 bullet 목록 */}
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

function GanttViewInline() {
	const projectStart = toDate(mockProject.start);
	const projectEnd = toDate(mockProject.end);
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
					tasks={mockTasks}
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
	const labelWidth = 240;

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

	const statusBg = {
		done: "bg-[color:var(--color-green)]",
		"in-progress": "bg-[color:var(--color-orange)]",
		todo: "bg-bg-modifier",
	}[task.status];

	const progressBg = {
		done: "bg-[color:var(--color-green)]/60",
		"in-progress": "bg-[color:var(--color-orange)]/60",
		todo: "bg-bg-modifier",
	}[task.status];

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
				<div className="flex-1 truncate">
					<p className="truncate text-text-normal font-medium">{task.name}</p>
					{task.assignee && (
						<p className="truncate text-[10px] text-text-faint">
							@{task.assignee}
						</p>
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
							statusBg,
						)}
						style={{ left, width }}
						title={`${task.name} · ${task.start} ~ ${task.end} · ${task.progress}%`}
					>
						<div
							className={cn("h-full", progressBg)}
							style={{ width: `${task.progress}%` }}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
