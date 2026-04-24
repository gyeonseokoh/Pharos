/**
 * MeetingsListView — 회의 목록 뷰 (주 접근 경로).
 *
 * 캘린더가 "날짜 기반 편의 뷰"라면, 이건 "모든 회의 색인". Dashboard의 주 네비 타겟.
 * 각 회의 카드 클릭 → Meeting Page로 이동.
 *
 * 순수 프레젠테이션. 데이터는 props로 주입.
 */

import { useMemo, useState } from "react";
import {
	Calendar,
	CheckCircle2,
	Clock,
	FileText,
	Users,
} from "lucide-react";
import { BackNav, type BackNavItem } from "shared/ui/BackNav";
import { Button } from "shared/ui/Button";
import { Card, CardContent } from "shared/ui/Card";
import { cn } from "shared/ui/utils";
import type { MeetingType } from "../domain/calendarData";
import type { MeetingStatus } from "../domain/meetingPageData";
import type {
	MeetingListItem,
	MeetingsListData,
} from "../domain/meetingsListData";

type Filter = "all" | "upcoming" | "completed";
type TypeFilter = "all" | "regular" | "adhoc";

export interface MeetingsListViewProps {
	data: MeetingsListData;
	/** 임시 회의 추가 (PO-4). */
	onAddAdhocMeeting?: () => void;
	/** 회의 카드 클릭 → Meeting Page 이동. */
	onOpenMeeting?: (meetingId: string) => void;
	/** "회의록 모음 보기" 링크 클릭. */
	onOpenMinutesArchive?: () => void;
	/** "캘린더로 보기" 링크 클릭 (편의 뷰 전환). */
	onOpenCalendar?: () => void;
	onBackToHome?: () => void;
}

export function MeetingsListView({
	data,
	onAddAdhocMeeting,
	onOpenMeeting,
	onOpenMinutesArchive,
	onOpenCalendar,
	onBackToHome,
}: MeetingsListViewProps) {
	const [filter, setFilter] = useState<Filter>("all");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

	const filtered = useMemo(() => {
		const today = new Date().toISOString().slice(0, 10);
		return data.meetings.filter((m) => {
			if (filter === "upcoming" && m.date < today) return false;
			if (filter === "completed" && m.status !== "completed") return false;
			if (typeFilter !== "all" && m.type !== typeFilter) return false;
			return true;
		});
	}, [data.meetings, filter, typeFilter]);

	const counts = useMemo(() => {
		const today = new Date().toISOString().slice(0, 10);
		return {
			all: data.meetings.length,
			upcoming: data.meetings.filter((m) => m.date >= today).length,
			completed: data.meetings.filter((m) => m.status === "completed").length,
		};
	}, [data.meetings]);

	// 날짜별 그룹핑
	const grouped = useMemo(() => groupByDate(filtered), [filtered]);

	const navItems: BackNavItem[] = [];
	if (onBackToHome)
		navItems.push({ icon: "home", label: "홈으로", onClick: onBackToHome });

	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-4xl space-y-6">
				{navItems.length > 0 && <BackNav items={navItems} />}
				<Header
					onAddAdhocMeeting={onAddAdhocMeeting}
					onOpenCalendar={onOpenCalendar}
					onOpenMinutesArchive={onOpenMinutesArchive}
				/>

				<div className="flex flex-wrap items-center justify-between gap-3">
					<StatusTabs active={filter} onChange={setFilter} counts={counts} />
					<TypeFilterDropdown active={typeFilter} onChange={setTypeFilter} />
				</div>

				{filtered.length === 0 ? (
					<EmptyState filter={filter} />
				) : (
					<div className="space-y-6">
						{grouped.map(({ date, items }) => (
							<DateGroup
								key={date}
								date={date}
								items={items}
								onOpenMeeting={onOpenMeeting}
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
	onAddAdhocMeeting,
	onOpenCalendar,
	onOpenMinutesArchive,
}: {
	onAddAdhocMeeting?: () => void;
	onOpenCalendar?: () => void;
	onOpenMinutesArchive?: () => void;
}) {
	return (
		<header className="space-y-3">
			<div className="flex items-start justify-between">
				<div>
					<p className="text-xs uppercase tracking-wide text-text-faint">
						Pharos Meetings
					</p>
					<h1 className="mt-1 text-2xl font-bold text-text-normal">
						📋 회의 목록
					</h1>
				</div>
				{onAddAdhocMeeting && (
					<Button onClick={onAddAdhocMeeting}>+ 임시 회의 추가</Button>
				)}
			</div>

			<div className="flex flex-wrap gap-2 text-xs">
				{onOpenCalendar && (
					<button
						onClick={onOpenCalendar}
						className="inline-flex items-center gap-1 rounded-md border border-bg-modifier px-2.5 py-1 text-text-muted transition-colors hover:bg-[color:var(--background-modifier-hover)] hover:text-text-normal"
					>
						<Calendar className="h-3 w-3" />
						캘린더로 보기
					</button>
				)}
				{onOpenMinutesArchive && (
					<button
						onClick={onOpenMinutesArchive}
						className="inline-flex items-center gap-1 rounded-md border border-bg-modifier px-2.5 py-1 text-text-muted transition-colors hover:bg-[color:var(--background-modifier-hover)] hover:text-text-normal"
					>
						<FileText className="h-3 w-3" />
						회의록 모음
					</button>
				)}
			</div>
		</header>
	);
}

// ───────────────────────── Filters ─────────────────────────

function StatusTabs({
	active,
	onChange,
	counts,
}: {
	active: Filter;
	onChange: (f: Filter) => void;
	counts: { all: number; upcoming: number; completed: number };
}) {
	return (
		<div className="inline-flex rounded-md border border-bg-modifier bg-bg-secondary p-1">
			<TabButton
				active={active === "upcoming"}
				onClick={() => onChange("upcoming")}
				label="예정"
				count={counts.upcoming}
			/>
			<TabButton
				active={active === "completed"}
				onClick={() => onChange("completed")}
				label="완료"
				count={counts.completed}
			/>
			<TabButton
				active={active === "all"}
				onClick={() => onChange("all")}
				label="전체"
				count={counts.all}
			/>
		</div>
	);
}

function TabButton({
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
		<div
			onClick={onClick}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick();
				}
			}}
			className={cn(
				"cursor-pointer select-none rounded px-3 py-1.5 text-xs font-medium transition-colors",
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
		</div>
	);
}

function TypeFilterDropdown({
	active,
	onChange,
}: {
	active: TypeFilter;
	onChange: (t: TypeFilter) => void;
}) {
	return (
		<div className="flex items-center gap-1 text-xs">
			<span className="text-text-muted">유형:</span>
			<div className="inline-flex rounded-md border border-bg-modifier bg-bg-secondary p-0.5">
				{(
					[
						{ key: "all", label: "모두" },
						{ key: "regular", label: "정기" },
						{ key: "adhoc", label: "임시" },
					] as const
				).map((opt) => (
					<div
						key={opt.key}
						onClick={() => onChange(opt.key)}
						role="button"
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onChange(opt.key);
							}
						}}
						className={cn(
							"cursor-pointer select-none rounded px-2 py-1 text-[11px] font-medium transition-colors",
							active === opt.key
								? "bg-[color:var(--interactive-accent)] text-[color:var(--text-on-accent)]"
								: "text-text-muted hover:text-text-normal",
						)}
					>
						{opt.label}
					</div>
				))}
			</div>
		</div>
	);
}

// ───────────────────────── Date Group ─────────────────────────

function DateGroup({
	date,
	items,
	onOpenMeeting,
}: {
	date: string;
	items: MeetingListItem[];
	onOpenMeeting?: (id: string) => void;
}) {
	const today = new Date().toISOString().slice(0, 10);
	const dateObj = new Date(date + "T00:00:00");
	const weekday = ["일", "월", "화", "수", "목", "금", "토"][dateObj.getDay()]!;
	const isToday = date === today;
	const isPast = date < today;

	return (
		<section>
			<header className="mb-2 flex items-baseline gap-2">
				<span
					className={cn(
						"text-sm font-semibold",
						isToday
							? "text-[color:var(--interactive-accent)]"
							: isPast
								? "text-text-faint"
								: "text-text-normal",
					)}
				>
					{date} ({weekday})
					{isToday && " · 오늘"}
				</span>
				<span className="text-[11px] text-text-faint">· {items.length}건</span>
			</header>
			<div className="space-y-2">
				{items.map((m) => (
					<MeetingCard key={m.id} meeting={m} onOpen={onOpenMeeting} />
				))}
			</div>
		</section>
	);
}

// ───────────────────────── Meeting Card ─────────────────────────

function MeetingCard({
	meeting,
	onOpen,
}: {
	meeting: MeetingListItem;
	onOpen?: (id: string) => void;
}) {
	return (
		<Card
			className={cn(
				"cursor-pointer transition-all hover:border-[color:var(--interactive-accent)]/50 hover:shadow-md",
				meeting.status === "completed" && "opacity-80",
			)}
		>
			<CardContent
				onClick={() => onOpen?.(meeting.id)}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onOpen?.(meeting.id);
					}
				}}
				className="flex items-center gap-4 p-4"
			>
				<TypeIndicator type={meeting.type} />

				<div className="flex-1 min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-sm font-semibold text-text-normal">
							{meeting.title}
						</h3>
						<StatusBadge status={meeting.status} hasMinutes={meeting.hasMinutes} />
					</div>

					<div className="mt-1 flex items-center gap-3 text-[11px] text-text-faint">
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{meeting.time} · {meeting.durationMinutes}분
						</span>
						<span>·</span>
						<span>{labelForType(meeting.type)}</span>
						{meeting.topicCount > 0 && (
							<>
								<span>·</span>
								<span>🎯 주제 {meeting.topicCount}</span>
							</>
						)}
						{meeting.attendeeCount > 0 && (
							<>
								<span>·</span>
								<span className="flex items-center gap-1">
									<Users className="h-3 w-3" />
									{meeting.attendeeCount}
								</span>
							</>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function TypeIndicator({ type }: { type: MeetingType }) {
	const color =
		type === "regular"
			? "var(--interactive-accent)"
			: "var(--color-orange)";
	return (
		<div
			className="h-10 w-1 shrink-0 rounded-full"
			style={{ backgroundColor: `color-mix(in srgb, ${color} 80%, transparent)` }}
		/>
	);
}

function StatusBadge({
	status,
	hasMinutes,
}: {
	status: MeetingStatus;
	hasMinutes: boolean;
}) {
	let label: string;
	let className: string;

	if (status === "completed") {
		label = hasMinutes ? "완료" : "회의록 미작성";
		className = hasMinutes
			? "bg-[color:var(--color-green)]/15 text-[color:var(--color-green)]"
			: "bg-[color:var(--color-orange)]/15 text-[color:var(--color-orange)]";
	} else if (status === "ready") {
		label = "준비 완료";
		className = "bg-[color:var(--color-blue)]/15 text-[color:var(--color-blue)]";
	} else {
		label = "주제 준비 중";
		className = "bg-bg-modifier text-text-muted";
	}

	return (
		<span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", className)}>
			{label}
		</span>
	);
}

function labelForType(type: MeetingType): string {
	return type === "regular" ? "정기 회의" : "임시 회의";
}

// ───────────────────────── Empty State ─────────────────────────

function EmptyState({ filter }: { filter: Filter }) {
	const messages = {
		all: "회의가 없습니다.",
		upcoming: "예정된 회의가 없습니다.",
		completed: "완료된 회의가 없습니다.",
	};
	return (
		<Card>
			<CardContent className="py-12 text-center">
				<CheckCircle2 className="mx-auto h-8 w-8 text-text-faint" />
				<p className="mt-2 text-sm text-text-muted">{messages[filter]}</p>
			</CardContent>
		</Card>
	);
}

// ───────────────────────── Helpers ─────────────────────────

function groupByDate(
	items: MeetingListItem[],
): { date: string; items: MeetingListItem[] }[] {
	const map = new Map<string, MeetingListItem[]>();
	for (const m of items) {
		if (!map.has(m.date)) map.set(m.date, []);
		map.get(m.date)!.push(m);
	}
	// 각 날짜의 회의는 시간 오름차순
	for (const list of map.values()) {
		list.sort((a, b) => a.time.localeCompare(b.time));
	}
	// 최신 날짜가 위로
	return Array.from(map.entries())
		.sort((a, b) => b[0].localeCompare(a[0]))
		.map(([date, items]) => ({ date, items }));
}
