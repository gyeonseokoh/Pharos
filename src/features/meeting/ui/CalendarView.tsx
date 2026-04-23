/**
 * CalendarView — 캘린더 뷰 (PO-1-1 고정 회의 + PO-4 임시 회의).
 *
 * 월 단위 그리드. 각 날짜 셀에 회의 pill 표시.
 *   - 이벤트 클릭 → `onOpenMeeting(id)` 호출 (회의 MD 페이지로 이동)
 *   - "+ 임시 회의 추가" 버튼 → `onAddAdhocMeeting(selectedDate)`
 *   - 빈 날짜 클릭 → 해당 날짜로 임시 회의 추가
 *
 *   - 오늘: `CalendarItemView`가 `mockCalendarData` 주입
 *   - 미래: `meetingService.listForMonth(YYYY-MM)` 결과 주입
 */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "shared/ui/Button";
import { cn } from "shared/ui/utils";
import type {
	CalendarData,
	CalendarMeeting,
	MeetingType,
} from "../domain/calendarData";

// ───────────────────────── Component ─────────────────────────

export interface CalendarViewProps {
	data: CalendarData;
	/** 이벤트 클릭 시 회의 페이지 열기. */
	onOpenMeeting?: (meetingId: string) => void;
	/** 임시 회의 추가. 날짜가 지정되면 해당 날짜로 초기값 세팅. */
	onAddAdhocMeeting?: (date?: string) => void;
}

export function CalendarView({
	data,
	onOpenMeeting,
	onAddAdhocMeeting,
}: CalendarViewProps) {
	// 오늘이 포함된 월로 시작
	const [cursor, setCursor] = useState<Date>(() => {
		const d = new Date();
		d.setDate(1);
		d.setHours(0, 0, 0, 0);
		return d;
	});

	const year = cursor.getFullYear();
	const month = cursor.getMonth(); // 0-based

	const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);

	// 이 달에 속하는 미팅을 날짜별로 묶기
	const byDate = useMemo(() => {
		const map = new Map<string, CalendarMeeting[]>();
		for (const m of data.meetings) {
			if (!map.has(m.date)) map.set(m.date, []);
			map.get(m.date)!.push(m);
		}
		// 각 날짜 배열을 시간 순 정렬
		for (const list of map.values()) {
			list.sort((a, b) => a.time.localeCompare(b.time));
		}
		return map;
	}, [data.meetings]);

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const goPrev = () => setCursor(shiftMonth(cursor, -1));
	const goNext = () => setCursor(shiftMonth(cursor, 1));
	const goToday = () => {
		const d = new Date();
		d.setDate(1);
		d.setHours(0, 0, 0, 0);
		setCursor(d);
	};

	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-5xl space-y-4">
				<Header
					year={year}
					month={month}
					onPrev={goPrev}
					onNext={goNext}
					onToday={goToday}
					onAddMeeting={() => onAddAdhocMeeting?.()}
				/>

				<WeekdayRow />

				<div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-bg-modifier bg-bg-modifier">
					{weeks.map((date, i) => (
						<DayCell
							key={i}
							date={date}
							inMonth={date.getMonth() === month}
							isToday={isSameDay(date, today)}
							meetings={byDate.get(formatISO(date)) ?? []}
							onOpenMeeting={onOpenMeeting}
							onAddMeeting={() => onAddAdhocMeeting?.(formatISO(date))}
						/>
					))}
				</div>

				<Legend />
			</div>
		</div>
	);
}

// ───────────────────────── Header ─────────────────────────

function Header({
	year,
	month,
	onPrev,
	onNext,
	onToday,
	onAddMeeting,
}: {
	year: number;
	month: number;
	onPrev: () => void;
	onNext: () => void;
	onToday: () => void;
	onAddMeeting: () => void;
}) {
	return (
		<header className="flex items-center justify-between">
			<div className="flex items-center gap-4">
				<h1 className="text-2xl font-bold text-text-normal">
					{year}년 {month + 1}월
				</h1>
				<div className="flex items-center gap-1">
					<IconButton onClick={onPrev} aria-label="이전 달">
						<ChevronLeft className="h-4 w-4" />
					</IconButton>
					<Button variant="secondary" size="sm" onClick={onToday}>
						오늘
					</Button>
					<IconButton onClick={onNext} aria-label="다음 달">
						<ChevronRight className="h-4 w-4" />
					</IconButton>
				</div>
			</div>

			<Button onClick={onAddMeeting}>
				<Plus className="mr-1 h-4 w-4" />
				임시 회의 추가
			</Button>
		</header>
	);
}

function IconButton({
	onClick,
	children,
	...rest
}: {
	onClick: () => void;
	children: React.ReactNode;
	[key: string]: unknown;
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
			className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-[color:var(--background-modifier-hover)] hover:text-text-normal"
			{...rest}
		>
			{children}
		</div>
	);
}

// ───────────────────────── Weekday Row ─────────────────────────

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function WeekdayRow() {
	return (
		<div className="grid grid-cols-7 gap-px">
			{WEEKDAY_LABELS.map((label, i) => (
				<div
					key={label}
					className={cn(
						"px-2 py-1.5 text-center text-xs font-semibold",
						i === 0
							? "text-[color:var(--color-red)]"
							: i === 6
								? "text-[color:var(--color-blue)]"
								: "text-text-muted",
					)}
				>
					{label}
				</div>
			))}
		</div>
	);
}

// ───────────────────────── Day Cell ─────────────────────────

function DayCell({
	date,
	inMonth,
	isToday,
	meetings,
	onOpenMeeting,
	onAddMeeting,
}: {
	date: Date;
	inMonth: boolean;
	isToday: boolean;
	meetings: CalendarMeeting[];
	onOpenMeeting?: (id: string) => void;
	onAddMeeting: () => void;
}) {
	const dayNumber = date.getDate();
	const dayOfWeek = date.getDay();

	const MAX_VISIBLE = 3;
	const visible = meetings.slice(0, MAX_VISIBLE);
	const overflow = meetings.length - MAX_VISIBLE;

	const handleAddClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onAddMeeting();
	};

	return (
		<div
			className={cn(
				"group relative min-h-[124px] bg-bg-secondary p-1.5",
				!inMonth && "bg-bg-primary/50",
			)}
		>
			<div className="mb-1 flex items-center justify-between">
				<span
					className={cn(
						"flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
						!inMonth && "text-text-faint",
						inMonth && dayOfWeek === 0 && "text-[color:var(--color-red)]",
						inMonth && dayOfWeek === 6 && "text-[color:var(--color-blue)]",
						inMonth && dayOfWeek > 0 && dayOfWeek < 6 && "text-text-normal",
						isToday &&
							"bg-[color:var(--interactive-accent)] text-[color:var(--text-on-accent)]",
					)}
				>
					{dayNumber}
				</span>

				{/* hover 시 이 날짜로 임시 회의 추가 (명시적 클릭 버튼) */}
				<div
					onClick={handleAddClick}
					role="button"
					tabIndex={-1}
					title={`${formatISO(date)} 에 임시 회의 추가`}
					className="flex h-5 w-5 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity hover:bg-[color:var(--background-modifier-hover)] group-hover:opacity-100"
				>
					<Plus className="h-3 w-3 text-text-faint" />
				</div>
			</div>

			<div className="space-y-0.5">
				{visible.map((m) => (
					<MeetingPill
						key={m.id}
						meeting={m}
						onClick={() => onOpenMeeting?.(m.id)}
					/>
				))}
				{overflow > 0 && (
					<p className="pl-1 text-[10px] text-text-faint">
						+ {overflow}건 더
					</p>
				)}
			</div>
		</div>
	);
}

// ───────────────────────── Meeting Pill ─────────────────────────

function MeetingPill({
	meeting,
	onClick,
}: {
	meeting: CalendarMeeting;
	onClick: () => void;
}) {
	const styleByType: Record<MeetingType, string> = {
		regular:
			"bg-[color:var(--interactive-accent)]/15 text-[color:var(--interactive-accent)] hover:bg-[color:var(--interactive-accent)]/25",
		adhoc:
			"bg-[color:var(--color-orange)]/15 text-[color:var(--color-orange)] hover:bg-[color:var(--color-orange)]/25",
	};

	const typeLabel = meeting.type === "regular" ? "정기 회의" : "임시 회의";

	return (
		<div
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.stopPropagation();
					onClick();
				}
			}}
			className={cn(
				"cursor-pointer rounded px-1.5 py-1 transition-colors",
				styleByType[meeting.type],
			)}
			title={`${meeting.time} · ${meeting.title} (${typeLabel})${meeting.topicCount === 0 ? " · 주제 미정" : ""}`}
		>
			<div className="flex items-center gap-1 truncate text-[10px] font-medium leading-tight">
				<span className="shrink-0 font-mono">{meeting.time}</span>
				<span className="truncate">{meeting.title}</span>
			</div>
			<div className="mt-0.5 truncate text-[9px] leading-tight opacity-70">
				{typeLabel}
				{meeting.topicCount === 0 && " · 주제 미정"}
			</div>
		</div>
	);
}

// ───────────────────────── Legend ─────────────────────────

function Legend() {
	return (
		<div className="flex items-center gap-4 text-xs text-text-muted">
			<div className="flex items-center gap-1.5">
				<span className="h-3 w-3 rounded bg-[color:var(--interactive-accent)]/30" />
				<span>고정 회의</span>
			</div>
			<div className="flex items-center gap-1.5">
				<span className="h-3 w-3 rounded bg-[color:var(--color-orange)]/30" />
				<span>임시 회의</span>
			</div>
			<div className="flex items-center gap-1.5 text-text-faint">
				<span className="text-[10px]">· 클릭하면 회의 페이지 열림</span>
			</div>
		</div>
	);
}

// ───────────────────────── Helpers ─────────────────────────

/**
 * 해당 월을 포함하는 6주(42일) 그리드를 반환.
 * 전·후월 날짜도 포함되어 주가 정확히 맞아떨어짐.
 */
function buildMonthGrid(year: number, month: number): Date[] {
	const firstDay = new Date(year, month, 1);
	const firstDayOfWeek = firstDay.getDay(); // 0 = 일
	const start = new Date(firstDay);
	start.setDate(start.getDate() - firstDayOfWeek);

	const days: Date[] = [];
	for (let i = 0; i < 42; i++) {
		const d = new Date(start);
		d.setDate(d.getDate() + i);
		days.push(d);
	}
	return days;
}

function shiftMonth(date: Date, delta: number): Date {
	const d = new Date(date);
	d.setMonth(d.getMonth() + delta);
	return d;
}

function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function formatISO(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}
