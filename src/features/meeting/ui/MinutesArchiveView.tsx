/**
 * MinutesArchiveView — 회의록 모음 페이지.
 */

import { useMemo, useState } from "react";
import { FileText, Search, Sparkles } from "lucide-react";
import { BackNav, type BackNavItem } from "shared/ui/BackNav";
import { Card, CardContent } from "shared/ui/Card";
import { cn } from "shared/ui/utils";
import type {
	MinutesArchiveData,
	MinutesArchiveItem,
} from "../domain/minutesArchiveData";

export interface MinutesArchiveViewProps {
	data: MinutesArchiveData;
	onOpenMeeting?: (meetingId: string) => void;
	onBackToMeetingsList?: () => void;
	onBackToHome?: () => void;
}

export function MinutesArchiveView({
	data,
	onOpenMeeting,
	onBackToMeetingsList,
	onBackToHome,
}: MinutesArchiveViewProps) {
	const [query, setQuery] = useState("");

	const filtered = useMemo(() => {
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
					<h1 className="text-2xl font-bold text-text-normal">📚 회의록 모음</h1>
					<p className="text-xs text-text-muted">
						전체 {data.items.length}건 · 최신 순
					</p>
				</header>

				<SearchBar value={query} onChange={setQuery} />

				{filtered.length === 0 ? (
					<EmptyState isSearch={query.length > 0} />
				) : (
					<div className="space-y-3">
						{filtered.map((item) => (
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

function SearchBar({
	value,
	onChange,
}: {
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className="relative">
			<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="제목, 본문, 작성자, AI 요약에서 검색…"
				className="w-full rounded-md border border-bg-modifier bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-normal placeholder:text-text-faint focus:border-[color:var(--interactive-accent)] focus:outline-none"
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

				<h3 className="mt-1.5 text-sm font-semibold text-text-normal">
					{item.meetingTitle}
				</h3>

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

function EmptyState({ isSearch }: { isSearch: boolean }) {
	return (
		<Card>
			<CardContent className="flex flex-col items-center gap-2 py-12 text-center">
				<FileText className={cn("h-8 w-8 text-text-faint")} />
				<p className="text-sm text-text-muted">
					{isSearch ? "검색 결과가 없습니다." : "아직 작성된 회의록이 없습니다."}
				</p>
			</CardContent>
		</Card>
	);
}
