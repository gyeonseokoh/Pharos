/**
 * MyTasksView — 내 업무 뷰 (PO-12 개인 타임라인 + PM-3 체크리스트).
 *
 * 본인 전용 페이지. 내게 할당된 Task 리스트 + 체크리스트 체크 UI.
 *
 *   - 오늘: `MyTasksItemView`가 `mockMyTasksData` 주입
 *   - 미래: 같은 ItemView가 `taskService.getMine()` + `checklistService` 결과 주입
 *
 * 체크박스 클릭은 `onToggleCheck` 콜백으로 위임. 콜백 없으면 내부 state로 UI 전용 동작.
 */

import { useMemo, useState } from "react";
import {
	ChevronDown,
	ChevronRight,
	CheckCircle2,
	Circle,
	Clock,
	ListChecks,
	Timer,
} from "lucide-react";
import { Button } from "shared/ui/Button";
import { Card, CardContent } from "shared/ui/Card";
import { cn } from "shared/ui/utils";
import type {
	MyChecklistItem,
	MyTask,
	MyTasksData,
	MyTasksStats,
	TaskPriority,
	TaskStatus,
} from "../domain/myTasksData";

type StatusFilter = "all" | "in-progress" | "todo" | "done";

// ───────────────────────── Component ─────────────────────────

export interface MyTasksViewProps {
	data: MyTasksData;
	/**
	 * 체크박스 토글 시 호출. 제공되지 않으면 내부 state로만 동작(UI 전용 데모).
	 * 실제 구현에선 `checklistService.toggle(taskId, itemId)` 호출.
	 */
	onToggleCheck?: (taskId: string, itemId: string, nextChecked: boolean) => void;
}

export function MyTasksView({ data, onToggleCheck }: MyTasksViewProps) {
	const [filter, setFilter] = useState<StatusFilter>("all");

	// UI 전용 체크 상태 (콜백 없을 때만 사용)
	const [localChecks, setLocalChecks] = useState<Map<string, boolean>>(() => {
		const map = new Map<string, boolean>();
		for (const task of data.tasks) {
			for (const item of task.checklist) {
				map.set(`${task.id}|${item.id}`, item.checked);
			}
		}
		return map;
	});

	const isChecked = (taskId: string, itemId: string): boolean => {
		if (onToggleCheck) {
			// 콜백 있으면 props 상태가 권위
			const task = data.tasks.find((t) => t.id === taskId);
			return task?.checklist.find((c) => c.id === itemId)?.checked ?? false;
		}
		return localChecks.get(`${taskId}|${itemId}`) ?? false;
	};

	const handleToggle = (taskId: string, itemId: string) => {
		const current = isChecked(taskId, itemId);
		const next = !current;
		if (onToggleCheck) {
			onToggleCheck(taskId, itemId, next);
		} else {
			setLocalChecks((prev) => {
				const m = new Map(prev);
				m.set(`${taskId}|${itemId}`, next);
				return m;
			});
		}
	};

	const filteredTasks = useMemo(() => {
		if (filter === "all") return data.tasks;
		return data.tasks.filter((t) => t.status === filter);
	}, [data.tasks, filter]);

	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-4xl space-y-6">
				<Header profile={data.profile} />
				<StatsBar stats={data.stats} />
				<FilterTabs active={filter} onChange={setFilter} data={data} />

				{filteredTasks.length === 0 ? (
					<EmptyState filter={filter} />
				) : (
					<div className="space-y-3">
						{filteredTasks.map((task) => (
							<TaskCard
								key={task.id}
								task={task}
								isChecked={isChecked}
								onToggle={handleToggle}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// ───────────────────────── Header ─────────────────────────

function Header({
	profile,
}: {
	profile: MyTasksData["profile"];
}) {
	return (
		<header className="flex items-center gap-4">
			<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--interactive-accent)] text-base font-bold text-[color:var(--text-on-accent)]">
				{profile.name[0]}
			</div>
			<div>
				<p className="text-xs uppercase tracking-wide text-text-faint">
					내 업무 · {profile.role}
				</p>
				<h1 className="mt-0.5 text-2xl font-bold text-text-normal">
					{profile.name}
				</h1>
			</div>
		</header>
	);
}

// ───────────────────────── Stats Bar ─────────────────────────

function StatsBar({ stats }: { stats: MyTasksStats }) {
	const progressPercent =
		stats.totalChecklistItems === 0
			? 0
			: Math.round(
					(stats.completedChecklistItems / stats.totalChecklistItems) * 100,
				);

	return (
		<Card>
			<CardContent className="p-5">
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
					<StatItem
						icon={<Timer className="h-4 w-4 text-[color:var(--color-orange)]" />}
						label="진행 중"
						value={stats.inProgressTasks}
						sub={`전체 ${stats.totalTasks}건 중`}
					/>
					<StatItem
						icon={<Clock className="h-4 w-4 text-text-muted" />}
						label="오늘 마감"
						value={stats.dueTodayTasks}
						sub={stats.dueTodayTasks > 0 ? "⚠️ 확인 필요" : "없음"}
						warn={stats.dueTodayTasks > 0}
					/>
					<StatItem
						icon={<ListChecks className="h-4 w-4 text-[color:var(--color-green)]" />}
						label="체크 완료"
						value={`${stats.completedChecklistItems}/${stats.totalChecklistItems}`}
						sub={`${progressPercent}%`}
					/>
					<div className="flex flex-col justify-center">
						<div className="mb-1 flex items-baseline justify-between">
							<p className="text-xs font-medium text-text-muted">전체 진척</p>
							<p className="text-sm font-bold text-text-normal">{progressPercent}%</p>
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-bg-modifier">
							<div
								className="h-full bg-[color:var(--interactive-accent)] transition-all"
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function StatItem({
	icon,
	label,
	value,
	sub,
	warn,
}: {
	icon: React.ReactNode;
	label: string;
	value: number | string;
	sub?: string;
	warn?: boolean;
}) {
	return (
		<div>
			<div className="flex items-center gap-1.5 text-xs text-text-muted">
				{icon}
				<span>{label}</span>
			</div>
			<p className="mt-1 text-xl font-bold text-text-normal">{value}</p>
			{sub && (
				<p
					className={cn(
						"mt-0.5 text-[11px]",
						warn ? "text-[color:var(--color-orange)]" : "text-text-faint",
					)}
				>
					{sub}
				</p>
			)}
		</div>
	);
}

// ───────────────────────── Filter Tabs ─────────────────────────

function FilterTabs({
	active,
	onChange,
	data,
}: {
	active: StatusFilter;
	onChange: (f: StatusFilter) => void;
	data: MyTasksData;
}) {
	const counts = {
		all: data.tasks.length,
		"in-progress": data.stats.inProgressTasks,
		todo: data.stats.todoTasks,
		done: data.stats.doneTasks,
	};

	return (
		<div className="inline-flex rounded-md border border-bg-modifier bg-bg-secondary p-1">
			<FilterButton
				active={active === "all"}
				onClick={() => onChange("all")}
				label="전체"
				count={counts.all}
			/>
			<FilterButton
				active={active === "in-progress"}
				onClick={() => onChange("in-progress")}
				label="진행 중"
				count={counts["in-progress"]}
			/>
			<FilterButton
				active={active === "todo"}
				onClick={() => onChange("todo")}
				label="예정"
				count={counts.todo}
			/>
			<FilterButton
				active={active === "done"}
				onClick={() => onChange("done")}
				label="완료"
				count={counts.done}
			/>
		</div>
	);
}

function FilterButton({
	active,
	onClick,
	label,
	count,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
	count: number;
}) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"rounded px-3 py-1.5 text-xs font-medium transition-colors",
				active
					? "bg-[color:var(--interactive-accent)] text-[color:var(--text-on-accent)]"
					: "text-text-muted hover:text-text-normal",
			)}
		>
			{label}
			<span
				className={cn(
					"ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
					active ? "bg-white/20" : "bg-bg-modifier",
				)}
			>
				{count}
			</span>
		</button>
	);
}

// ───────────────────────── Task Card ─────────────────────────

function TaskCard({
	task,
	isChecked,
	onToggle,
}: {
	task: MyTask;
	isChecked: (taskId: string, itemId: string) => boolean;
	onToggle: (taskId: string, itemId: string) => void;
}) {
	// 기본 상태: 진행 중이면 펼침, 나머지는 접힘
	const [expanded, setExpanded] = useState<boolean>(task.status === "in-progress");

	const completedCount = task.checklist.filter((c) =>
		isChecked(task.id, c.id),
	).length;
	const totalCount = task.checklist.length;
	const progressPercent =
		totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

	const dday = calcDday(task.endDate);

	return (
		<Card
			className={cn(
				"overflow-hidden",
				task.status === "done" && "opacity-75",
				task.status === "in-progress" &&
					"border-[color:var(--color-orange)]/40",
			)}
		>
			{/* Header (clickable) — div 로 구성해서 Obsidian 기본 button 스타일 충돌 회피 */}
			<div
				onClick={() => setExpanded((v) => !v)}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setExpanded((v) => !v);
					}
				}}
				className="flex cursor-pointer select-none items-start gap-3 p-5 transition-colors hover:bg-[color:var(--background-modifier-hover)]"
			>
				{expanded ? (
					<ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
				) : (
					<ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
				)}

				<div className="flex-1 min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-sm font-semibold leading-none text-text-normal">
							<span className="font-mono text-text-accent">{task.id}</span>{" "}
							<span className="ml-1">{task.title}</span>
						</p>
						<StatusBadge status={task.status} />
						<PriorityBadge priority={task.priority} />
					</div>

					{task.description && (
						<p className="line-clamp-2 text-xs text-text-muted">
							{task.description}
						</p>
					)}

					<div className="flex items-center gap-3 text-[11px] text-text-faint">
						<span>
							📅 {task.startDate.slice(5)} ~ {task.endDate.slice(5)}
						</span>
						<DdayPill dday={dday} status={task.status} />
						<span>
							✅ {completedCount}/{totalCount}
						</span>
					</div>

					{/* 진척도 바 */}
					<div className="h-1.5 overflow-hidden rounded-full bg-bg-modifier">
						<div
							className={cn(
								"h-full transition-all",
								task.status === "done"
									? "bg-[color:var(--color-green)]"
									: task.status === "in-progress"
										? "bg-[color:var(--color-orange)]"
										: "bg-[color:var(--interactive-accent)]",
							)}
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
				</div>
			</div>

			{/* Checklist (펼쳤을 때만) */}
			{expanded && task.checklist.length > 0 && (
				<div className="border-t border-bg-modifier px-5 py-4">
					<p className="mb-2 pl-7 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
						체크리스트
					</p>
					<ul className="ml-7 space-y-0.5 border-l-2 border-bg-modifier pl-3">
						{task.checklist.map((item) => (
							<li key={item.id}>
								<ChecklistRow
									item={item}
									checked={isChecked(task.id, item.id)}
									onToggle={() => onToggle(task.id, item.id)}
								/>
							</li>
						))}
					</ul>
				</div>
			)}
		</Card>
	);
}

function StatusBadge({ status }: { status: TaskStatus }) {
	const config = {
		"in-progress": {
			label: "진행 중",
			class:
				"bg-[color:var(--color-orange)]/15 text-[color:var(--color-orange)]",
		},
		todo: {
			label: "예정",
			class: "bg-bg-modifier text-text-muted",
		},
		done: {
			label: "완료",
			class:
				"bg-[color:var(--color-green)]/15 text-[color:var(--color-green)]",
		},
	}[status];

	return (
		<span
			className={cn(
				"rounded-full px-2 py-0.5 text-[10px] font-medium",
				config.class,
			)}
		>
			{config.label}
		</span>
	);
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
	const config = {
		HIGH: { label: "🔴 HIGH", class: "text-[color:var(--color-red)]" },
		MEDIUM: { label: "🟡 MED", class: "text-[color:var(--color-orange)]" },
		LOW: { label: "🟢 LOW", class: "text-[color:var(--color-green)]" },
	}[priority];

	return (
		<span className={cn("text-[10px] font-semibold", config.class)}>
			{config.label}
		</span>
	);
}

function DdayPill({ dday, status }: { dday: number; status: TaskStatus }) {
	if (status === "done") return null;
	const tone =
		dday < 0
			? "text-[color:var(--color-red)] font-semibold"
			: dday === 0
				? "text-[color:var(--color-orange)] font-semibold"
				: dday <= 3
					? "text-[color:var(--color-orange)]"
					: "text-text-faint";
	const label =
		dday < 0 ? `⚠️ D+${Math.abs(dday)} 지연` : dday === 0 ? "오늘 마감" : `D-${dday}`;
	return <span className={tone}>{label}</span>;
}

// ───────────────────────── Checklist Row ─────────────────────────

function ChecklistRow({
	item,
	checked,
	onToggle,
}: {
	item: MyChecklistItem;
	checked: boolean;
	onToggle: () => void;
}) {
	return (
		<div
			onClick={onToggle}
			role="checkbox"
			aria-checked={checked}
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onToggle();
				}
			}}
			className="group flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-[color:var(--background-modifier-hover)]"
		>
			{checked ? (
				<CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--color-green)]" />
			) : (
				<Circle className="h-4 w-4 shrink-0 text-text-faint group-hover:text-text-muted" />
			)}
			<span
				className={cn(
					"flex-1",
					checked ? "text-text-faint line-through" : "text-text-normal",
				)}
			>
				{item.text}
			</span>
			{checked && item.checkedAt && (
				<span className="shrink-0 text-[10px] text-text-faint">
					{formatTime(item.checkedAt)}
				</span>
			)}
		</div>
	);
}

// ───────────────────────── Empty State ─────────────────────────

function EmptyState({ filter }: { filter: StatusFilter }) {
	const messages = {
		all: "할당된 업무가 없습니다.",
		"in-progress": "진행 중인 업무가 없습니다.",
		todo: "예정된 업무가 없습니다.",
		done: "완료된 업무가 없습니다.",
	};
	return (
		<Card>
			<CardContent className="py-12 text-center">
				<p className="text-sm text-text-muted">{messages[filter]}</p>
				{filter !== "all" && (
					<Button variant="ghost" size="sm" className="mt-3">
						전체 보기
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

// ───────────────────────── Helpers ─────────────────────────

function calcDday(endDate: string): number {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const end = new Date(endDate + "T00:00:00");
	return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatTime(iso: string): string {
	const d = new Date(iso);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${hh}:${mm}`;
}
