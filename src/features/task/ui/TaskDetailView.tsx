/**
 * TaskDetailView — Task 1건의 상세 페이지.
 * 체크리스트 관리 (PM-3) + 커밋 검증 결과 (PM-4) 표시.
 */

import { useMemo, useState } from "react";
import {
	CheckCircle2,
	Circle,
	GitCommit,
	Link2,
	Sparkles,
	User,
} from "lucide-react";
import { BackNav, type BackNavItem } from "shared/ui/BackNav";
import { Button } from "shared/ui/Button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "shared/ui/Card";
import { cn } from "shared/ui/utils";
import type {
	CommitVerifyResult,
	TaskChecklistItem,
	TaskDetailData,
	TaskLinkedCommit,
	TaskPriority,
	TaskStatus,
} from "../domain/taskDetailData";

export interface TaskDetailViewProps {
	data: TaskDetailData;
	onBackToMyTasks?: () => void;
	onBackToHome?: () => void;
	onGenerateChecklist?: () => void;
	onToggleCheck?: (itemId: string, next: boolean) => void;
}

export function TaskDetailView({
	data,
	onBackToMyTasks,
	onBackToHome,
	onGenerateChecklist,
	onToggleCheck,
}: TaskDetailViewProps) {
	const [localChecks, setLocalChecks] = useState<Map<string, boolean>>(
		() => new Map(data.checklist.map((c) => [c.id, c.checked])),
	);

	const isChecked = (id: string) =>
		onToggleCheck
			? (data.checklist.find((c) => c.id === id)?.checked ?? false)
			: (localChecks.get(id) ?? false);

	const handleToggle = (id: string) => {
		const next = !isChecked(id);
		if (onToggleCheck) onToggleCheck(id, next);
		else
			setLocalChecks((prev) => {
				const m = new Map(prev);
				m.set(id, next);
				return m;
			});
	};

	const completed = useMemo(
		() => data.checklist.filter((c) => isChecked(c.id)).length,
		[data.checklist, localChecks, isChecked],
	);
	const total = data.checklist.length;
	const progressPercent =
		total === 0 ? 0 : Math.round((completed / total) * 100);

	const navItems: BackNavItem[] = [];
	if (onBackToMyTasks)
		navItems.push({
			icon: "myTasks",
			label: "내 업무로",
			onClick: onBackToMyTasks,
		});
	if (onBackToHome)
		navItems.push({ icon: "home", label: "홈으로", onClick: onBackToHome });

	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-3xl space-y-6">
				{navItems.length > 0 && <BackNav items={navItems} />}

				<Header data={data} />

				<MetaCard
					data={data}
					completed={completed}
					total={total}
					progressPercent={progressPercent}
				/>

				<ChecklistCard
					items={data.checklist}
					isChecked={isChecked}
					onToggle={handleToggle}
					onGenerateChecklist={onGenerateChecklist}
				/>

				<CommitsCard commits={data.linkedCommits} />

				{data.dependsOn.length > 0 && <DependenciesCard deps={data.dependsOn} />}
			</div>
		</div>
	);
}

// ───────────────────────── Header ─────────────────────────

function Header({ data }: { data: TaskDetailData }) {
	return (
		<header className="space-y-2">
			<div className="flex items-center gap-2 text-xs">
				<StatusBadge status={data.status} />
				<PriorityBadge priority={data.priority} />
				<span className="rounded-full bg-bg-modifier px-2 py-0.5 font-medium text-text-muted">
					{data.phase === "PLANNING" ? "기획 단계" : "개발 단계"}
				</span>
			</div>
			<h1 className="text-2xl font-bold text-text-normal">
				<span className="font-mono text-text-accent">{data.id}</span>{" "}
				<span>{data.title}</span>
			</h1>
			{data.description && (
				<p className="text-sm leading-relaxed text-text-muted">
					{data.description}
				</p>
			)}
		</header>
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

// ───────────────────────── Meta Card ─────────────────────────

function MetaCard({
	data,
	completed,
	total,
	progressPercent,
}: {
	data: TaskDetailData;
	completed: number;
	total: number;
	progressPercent: number;
}) {
	return (
		<Card>
			<CardContent className="space-y-4 p-5">
				<div className="grid grid-cols-3 gap-4 text-xs">
					<MetaItem
						icon={<User className="h-3 w-3" />}
						label="담당자"
						value={data.assignee?.name ?? "미배정"}
					/>
					<MetaItem
						label="기간"
						value={`${data.startDate.slice(5)} ~ ${data.endDate.slice(5)}`}
					/>
					<MetaItem
						label="진척도"
						value={`${completed}/${total} (${progressPercent}%)`}
					/>
				</div>
				<div className="h-1.5 overflow-hidden rounded-full bg-bg-modifier">
					<div
						className={cn(
							"h-full transition-all",
							data.status === "done"
								? "bg-[color:var(--color-green)]"
								: data.status === "in-progress"
									? "bg-[color:var(--color-orange)]"
									: "bg-[color:var(--interactive-accent)]",
						)}
						style={{ width: `${progressPercent}%` }}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

function MetaItem({
	icon,
	label,
	value,
}: {
	icon?: React.ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div>
			<p className="flex items-center gap-1 text-[11px] text-text-muted">
				{icon}
				{label}
			</p>
			<p className="mt-0.5 text-sm font-semibold text-text-normal">{value}</p>
		</div>
	);
}

// ───────────────────────── Checklist ─────────────────────────

function ChecklistCard({
	items,
	isChecked,
	onToggle,
	onGenerateChecklist,
}: {
	items: TaskChecklistItem[];
	isChecked: (id: string) => boolean;
	onToggle: (id: string) => void;
	onGenerateChecklist?: () => void;
}) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>✅ 체크리스트</CardTitle>
					{items.length === 0 && onGenerateChecklist && (
						<Button variant="outline" size="sm" onClick={onGenerateChecklist}>
							<Sparkles className="mr-1 h-3.5 w-3.5" />
							AI 세분화
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{items.length === 0 ? (
					<div className="py-6 text-center text-xs text-text-muted">
						아직 세분화되지 않았습니다. "AI 세분화"로 자동 생성하세요.
					</div>
				) : (
					<ul className="space-y-1">
						{items.map((item) => (
							<li key={item.id}>
								<ChecklistRow
									item={item}
									checked={isChecked(item.id)}
									onToggle={() => onToggle(item.id)}
								/>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

function ChecklistRow({
	item,
	checked,
	onToggle,
}: {
	item: TaskChecklistItem;
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
			className="group flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-[color:var(--background-modifier-hover)]"
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
					{item.checkedBy} · {formatTime(item.checkedAt)}
				</span>
			)}
		</div>
	);
}

// ───────────────────────── Commits ─────────────────────────

function CommitsCard({ commits }: { commits: TaskLinkedCommit[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>💻 연결된 커밋</CardTitle>
			</CardHeader>
			<CardContent>
				{commits.length === 0 ? (
					<div className="py-6 text-center text-xs text-text-muted">
						아직 <span className="font-mono">feat(TASK-XXX):</span> 패턴 커밋이 없습니다.
					</div>
				) : (
					<ul className="space-y-2">
						{commits.map((c) => (
							<li key={c.sha}>
								<CommitRow commit={c} />
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

function CommitRow({ commit }: { commit: TaskLinkedCommit }) {
	return (
		<div className="rounded-md border border-bg-modifier p-3">
			<div className="flex items-start gap-2">
				<GitCommit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--color-blue)]" />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 text-xs">
						<span className="font-mono text-text-faint">
							{commit.sha.slice(0, 7)}
						</span>
						<VerifyBadge result={commit.verifyResult} />
					</div>
					<p className="mt-0.5 text-sm text-text-normal">{commit.message}</p>
					<p className="mt-1 text-[11px] text-text-faint">
						@{commit.author} · {formatDateTime(commit.date)}
						{commit.filesChanged !== undefined &&
							` · ${commit.filesChanged}개 파일`}
						{commit.linesAdded !== undefined && (
							<>
								{" · "}
								<span className="text-[color:var(--color-green)]">
									+{commit.linesAdded}
								</span>
								{commit.linesRemoved !== undefined && (
									<>
										{" "}
										<span className="text-[color:var(--color-red)]">
											-{commit.linesRemoved}
										</span>
									</>
								)}
							</>
						)}
					</p>
				</div>
			</div>
		</div>
	);
}

function VerifyBadge({ result }: { result: CommitVerifyResult }) {
	const config = {
		verified: {
			label: "✓ verified",
			class:
				"bg-[color:var(--color-green)]/15 text-[color:var(--color-green)]",
		},
		unverified: {
			label: "? unverified",
			class:
				"bg-[color:var(--color-orange)]/15 text-[color:var(--color-orange)]",
		},
		manual: {
			label: "수동",
			class: "bg-bg-modifier text-text-muted",
		},
	}[result];
	return (
		<span
			className={cn(
				"rounded-full px-1.5 py-0.5 text-[9px] font-medium",
				config.class,
			)}
		>
			{config.label}
		</span>
	);
}

// ───────────────────────── Dependencies ─────────────────────────

function DependenciesCard({
	deps,
}: {
	deps: Array<{ id: string; title: string }>;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>🔗 선행 작업</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="space-y-1">
					{deps.map((d) => (
						<li
							key={d.id}
							className="flex items-center gap-2 rounded-md p-2 text-xs hover:bg-[color:var(--background-modifier-hover)]"
						>
							<Link2 className="h-3.5 w-3.5 text-text-faint" />
							<span className="font-mono text-text-accent">{d.id}</span>
							<span className="text-text-normal">{d.title}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

// ───────────────────────── Helpers ─────────────────────────

function formatTime(iso: string): string {
	const d = new Date(iso);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${hh}:${mm}`;
}

function formatDateTime(iso: string): string {
	const d = new Date(iso);
	const date = `${d.getMonth() + 1}/${d.getDate()}`;
	return `${date} ${formatTime(iso)}`;
}
