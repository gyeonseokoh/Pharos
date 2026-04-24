/**
 * MinutesArchiveView — 회의록 관리 페이지 (4탭).
 *
 * 탭:
 *   - feature  : categories에 "feature" 포함된 회의록
 *   - progress : categories에 "progress" 포함된 회의록
 *   - date     : 전체 회의록을 월별로 그룹핑해 시간순 표시
 *   - misc     : 분류 안 된 회의록 + 상단 "회의록 작성" 진입점
 */

import { useMemo, useState } from "react";
import {
	CalendarDays,
	Cpu,
	FileText,
	Inbox,
	PenLine,
	Search,
	Sparkles,
	TrendingUp,
} from "lucide-react";
import { BackNav, type BackNavItem } from "shared/ui/BackNav";
import { Button } from "shared/ui/Button";
import { Card, CardContent } from "shared/ui/Card";
import { cn } from "shared/ui/utils";
import type {
	MinutesArchiveData,
	MinutesArchiveItem,
} from "../domain/minutesArchiveData";

type TabKey = "feature" | "progress" | "date" | "misc";

const TABS: { key: TabKey; label: string; icon: typeof Cpu }[] = [
	{ key: "feature", label: "기능 내용", icon: Cpu },
	{ key: "progress", label: "개발 진행도", icon: TrendingUp },
	{ key: "date", label: "날짜별", icon: CalendarDays },
	{ key: "misc", label: "기타 회의록", icon: Inbox },
];

export interface MinutesArchiveViewProps {
	data: MinutesArchiveData;
	onOpenMeeting?: (meetingId: string) => void;
	onUploadMinutes?: () => void;
	onBackToMeetingsList?: () => void;
	onBackToHome?: () => void;
}

export function MinutesArchiveView({
	data,
	onOpenMeeting,
	onUploadMinutes,
	onBackToMeetingsList,
	onBackToHome,
}: MinutesArchiveViewProps) {
	const [tab, setTab] = useState<TabKey>("feature");
	const [query, setQuery] = useState("");

	// 검색 필터 (탭 적용 전)
	const searchFiltered = useMemo(() => {
		if (!query.trim()) return data.items;
		const q = query.toLowerCase();
		return data.items.filter(
			(m) =>
				m.meetingTitle.toLowerCase().includes(q) ||
				m.preview.toLowerCase().includes(q) ||
				(m.aiSummary?.toLowerCase().includes(q) ?? false) ||
				m.authorName.toLowerCase().includes(q),
		);
	}, [data.items, query]);

	// 탭별 카운트 (검색 적용 후)
	const counts = useMemo(
		() => ({
			feature: searchFiltered.filter((i) => i.categories.includes("feature"))
				.length,
			progress: searchFiltered.filter((i) => i.categories.includes("progress"))
				.length,
			date: searchFiltered.length,
			misc: searchFiltered.filter((i) => i.categories.length === 0).length,
		}),
		[searchFiltered],
	);

	const navItems: BackNavItem[] = [];
	if (onBackToMeetingsList)
		navItems.push({
			icon: "list",
			label: "회의 목록으로",
			onClick: onBackToMeetingsList,
		});
	if (onBackToHome)
		navItems.push({ icon: "home", label: "홈으로", onClick: onBackToHome });

	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-3xl space-y-6">
				{navItems.length > 0 && <BackNav items={navItems} />}

				<header className="space-y-2">
					<p className="text-xs uppercase tracking-wide text-text-faint">
						Pharos Archive
					</p>
					<h1 className="text-2xl font-bold text-text-normal">
						🗂️ 회의록 관리
					</h1>
					<p className="text-xs text-text-muted">
						전체 {data.items.length}건 · 자동 분류로 정리됩니다
					</p>
				</header>

				<TabBar current={tab} onChange={setTab} counts={counts} />

				<SearchBar value={query} onChange={setQuery} />

				{tab === "feature" && (
					<CategoryList
						items={searchFiltered.filter((i) =>
							i.categories.includes("feature"),
						)}
						emptyText="기능 내용과 관련된 회의록이 아직 없습니다."
						isSearch={query.length > 0}
						onOpenMeeting={onOpenMeeting}
					/>
				)}
				{tab === "progress" && (
					<CategoryList
						items={searchFiltered.filter((i) =>
							i.categories.includes("progress"),
						)}
						emptyText="개발 진행도와 관련된 회의록이 아직 없습니다."
						isSearch={query.length > 0}
						onOpenMeeting={onOpenMeeting}
					/>
				)}
				{tab === "date" && (
					<DateGroupedList
						items={searchFiltered}
						isSearch={query.length > 0}
						onOpenMeeting={onOpenMeeting}
					/>
				)}
				{tab === "misc" && (
					<MiscTab
						items={searchFiltered.filter((i) => i.categories.length === 0)}
						isSearch={query.length > 0}
						onUploadMinutes={onUploadMinutes}
						onOpenMeeting={onOpenMeeting}
					/>
				)}
			</div>
		</div>
	);
}

// ───────────────────────── Tab bar ─────────────────────────

function TabBar({
	current,
	onChange,
	counts,
}: {
	current: TabKey;
	onChange: (t: TabKey) => void;
	counts: Record<TabKey, number>;
}) {
	return (
		<div className="flex items-center gap-1 border-b border-bg-modifier">
			{TABS.map((t) => {
				const Icon = t.icon;
				const active = current === t.key;
				return (
					<button
						key={t.key}
						type="button"
						onClick={() => onChange(t.key)}
						className={cn(
							"flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors",
							active
								? "border-[color:var(--interactive-accent)] text-[color:var(--interactive-accent)]"
								: "border-transparent text-text-muted hover:text-text-normal",
						)}
					>
						<Icon className="h-3.5 w-3.5" />
						{t.label}
						<span
							className={cn(
								"rounded-full px-1.5 py-0.5 text-[10px]",
								active
									? "bg-[color:var(--interactive-accent)]/15 text-[color:var(--interactive-accent)]"
									: "bg-bg-secondary text-text-faint",
							)}
						>
							{counts[t.key]}
						</span>
					</button>
				);
			})}
		</div>
	);
}

// ───────────────────────── Content lists ─────────────────────────

function CategoryList({
	items,
	emptyText,
	isSearch,
	onOpenMeeting,
}: {
	items: MinutesArchiveItem[];
	emptyText: string;
	isSearch: boolean;
	onOpenMeeting?: (meetingId: string) => void;
}) {
	if (items.length === 0) {
		return <EmptyState text={isSearch ? "검색 결과가 없습니다." : emptyText} />;
	}
	return (
		<div className="space-y-3">
			{items.map((item) => (
				<MinutesCard
					key={item.meetingId}
					item={item}
					onOpen={() => onOpenMeeting?.(item.meetingId)}
				/>
			))}
		</div>
	);
}

function DateGroupedList({
	items,
	isSearch,
	onOpenMeeting,
}: {
	items: MinutesArchiveItem[];
	isSearch: boolean;
	onOpenMeeting?: (meetingId: string) => void;
}) {
	const groups = useMemo(() => {
		const byMonth = new Map<string, MinutesArchiveItem[]>();
		for (const it of items) {
			const month = it.meetingDate.slice(0, 7); // YYYY-MM
			const arr = byMonth.get(month) ?? [];
			arr.push(it);
			byMonth.set(month, arr);
		}
		// 월 역순, 각 월 내부도 날짜 역순
		return [...byMonth.entries()]
			.sort(([a], [b]) => b.localeCompare(a))
			.map(([month, arr]) => ({
				month,
				items: arr.sort((a, b) =>
					b.meetingDate.localeCompare(a.meetingDate),
				),
			}));
	}, [items]);

	if (groups.length === 0) {
		return (
			<EmptyState
				text={isSearch ? "검색 결과가 없습니다." : "아직 작성된 회의록이 없습니다."}
			/>
		);
	}

	return (
		<div className="space-y-5">
			{groups.map((g) => (
				<section key={g.month} className="space-y-2">
					<h2 className="flex items-center gap-2 border-b border-bg-modifier pb-1 text-xs font-semibold text-text-muted">
						<CalendarDays className="h-3.5 w-3.5" />
						{formatMonth(g.month)}
						<span className="ml-auto text-text-faint">{g.items.length}건</span>
					</h2>
					<div className="space-y-2">
						{g.items.map((item) => (
							<MinutesCard
								key={item.meetingId}
								item={item}
								onOpen={() => onOpenMeeting?.(item.meetingId)}
							/>
						))}
					</div>
				</section>
			))}
		</div>
	);
}

function MiscTab({
	items,
	isSearch,
	onUploadMinutes,
	onOpenMeeting,
}: {
	items: MinutesArchiveItem[];
	isSearch: boolean;
	onUploadMinutes?: () => void;
	onOpenMeeting?: (meetingId: string) => void;
}) {
	return (
		<div className="space-y-5">
			{onUploadMinutes && (
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center gap-3 py-8 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--interactive-accent)]/10">
							<PenLine className="h-5 w-5 text-[color:var(--interactive-accent)]" />
						</div>
						<div className="space-y-1">
							<h3 className="text-sm font-semibold text-text-normal">
								회의록 추가하기
							</h3>
							<p className="text-xs text-text-muted">
								직접 입력하거나 파일(.txt / .md)을 업로드하면 AI가 자동 분류해
								<br />
								기능 내용 / 개발 진행도 탭으로 정리합니다.
							</p>
						</div>
						<Button onClick={onUploadMinutes} className="mt-1">
							<PenLine className="h-3.5 w-3.5" />
							회의록 작성
						</Button>
					</CardContent>
				</Card>
			)}

			<div className="space-y-2">
				<h2 className="flex items-center gap-2 text-xs font-semibold text-text-muted">
					<Inbox className="h-3.5 w-3.5" />
					분류되지 않은 회의록
					<span className="ml-auto text-text-faint">{items.length}건</span>
				</h2>
				{items.length === 0 ? (
					<EmptyState
						text={
							isSearch
								? "검색 결과가 없습니다."
								: "모든 회의록이 자동 분류되어 있습니다."
						}
					/>
				) : (
					<div className="space-y-3">
						{items.map((item) => (
							<MinutesCard
								key={item.meetingId}
								item={item}
								onOpen={() => onOpenMeeting?.(item.meetingId)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// ───────────────────────── Shared bits ─────────────────────────

function SearchBar({
	value,
	onChange,
}: {
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className="relative">
			<Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-faint" />
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="제목, 본문, 작성자, AI 요약에서 검색…"
				className="w-full rounded-md border border-bg-modifier bg-bg-secondary py-2 pl-10 pr-3 text-sm text-text-normal placeholder:text-text-faint focus:border-[color:var(--interactive-accent)] focus:outline-none"
				style={{ paddingLeft: "2.5rem" }}
			/>
		</div>
	);
}

function MinutesCard({
	item,
	onOpen,
}: {
	item: MinutesArchiveItem;
	onOpen: () => void;
}) {
	const typeLabel = item.meetingType === "regular" ? "정기" : "임시";
	const typeColor =
		item.meetingType === "regular"
			? "var(--interactive-accent)"
			: "var(--color-orange)";
	return (
		<Card className="cursor-pointer transition-all hover:border-[color:var(--interactive-accent)]/50 hover:shadow-md">
			<CardContent
				onClick={onOpen}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onOpen();
					}
				}}
				className="p-5"
			>
				<div className="flex items-center gap-2 text-[11px] text-text-faint">
					<span
						className="rounded-full px-1.5 py-0.5 font-medium"
						style={{
							backgroundColor: `color-mix(in srgb, ${typeColor} 15%, transparent)`,
							color: typeColor,
						}}
					>
						{typeLabel}
					</span>
					<span>{item.meetingDate}</span>
					<span>·</span>
					<span>✍️ {item.authorName}</span>
					<span>·</span>
					<span>{item.length}자</span>
				</div>

				<div className="mt-1.5 flex items-start justify-between gap-3">
					<h3 className="text-sm font-semibold text-text-normal">
						{item.meetingTitle}
					</h3>
					{item.categories.length > 0 && (
						<div className="flex shrink-0 gap-1">
							{item.categories.map((c) => (
								<CategoryBadge key={c} category={c} />
							))}
						</div>
					)}
				</div>

				{item.aiSummary && (
					<div className="mt-2 flex gap-2 rounded-md border-l-2 border-[color:var(--interactive-accent)] bg-[color:var(--interactive-accent)]/5 p-2">
						<Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--interactive-accent)]" />
						<p className="text-[11px] italic leading-relaxed text-text-muted">
							{item.aiSummary}
						</p>
					</div>
				)}

				<p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-muted">
					{item.preview}
					{item.length > 200 && "…"}
				</p>
			</CardContent>
		</Card>
	);
}

function CategoryBadge({ category }: { category: "feature" | "progress" }) {
	const config =
		category === "feature"
			? {
					label: "기능",
					icon: Cpu,
					color: "var(--color-blue)",
				}
			: {
					label: "진행도",
					icon: TrendingUp,
					color: "var(--color-green)",
				};
	const Icon = config.icon;
	return (
		<span
			className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
			style={{
				backgroundColor: `color-mix(in srgb, ${config.color} 12%, transparent)`,
				color: config.color,
			}}
		>
			<Icon className="h-2.5 w-2.5" />
			{config.label}
		</span>
	);
}

function EmptyState({ text }: { text: string }) {
	return (
		<Card>
			<CardContent className="flex flex-col items-center gap-2 py-10 text-center">
				<FileText className={cn("h-7 w-7 text-text-faint")} />
				<p className="text-sm text-text-muted">{text}</p>
			</CardContent>
		</Card>
	);
}

function formatMonth(ym: string): string {
	const [y, m] = ym.split("-");
	return `${y}년 ${Number(m)}월`;
}
