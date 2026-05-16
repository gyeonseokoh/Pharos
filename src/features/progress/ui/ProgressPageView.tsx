/**
 * ProgressPageView — 공개 진행도 페이지 (PO-12 팀 전체 공유).
 *
 * 순수 프레젠테이션 컴포넌트. 데이터는 props(`data`)로만 받는다.
 *   - 오늘: `ProgressPageItemView`가 `mockProgressPageData`를 주입.
 *   - 미래: `progressService.getTeamPage(period)` 결과를 주입.
 */

import { useState, useMemo } from "react";
import {
	CheckCircle2,
	GitCommit,
	RefreshCw,
	Sparkles,
	Users2,
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
	ActivityItem,
	MemberProgressDetail,
	ProgressPageData,
	TeamProgressSummary,
} from "../domain/progressPageData";

type PeriodFilter = "today" | "week";

// 멤버별 아바타 색상 (이름 기반 고정 매핑, 매번 같은 색)
const AVATAR_COLORS = [
	"#f97316", // orange
	"#3b82f6", // blue
	"#8b5cf6", // violet
	"#ec4899", // pink
	"#10b981", // emerald
	"#eab308", // yellow
	"#ef4444", // red
	"#06b6d4", // cyan
];

function avatarColor(memberId: string): string {
	let hash = 0;
	for (let i = 0; i < memberId.length; i++) {
		hash = (hash * 31 + memberId.charCodeAt(i)) | 0;
	}
	return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

// ───────────────────────── Component ─────────────────────────

export interface ProgressPageViewProps {
	data: ProgressPageData;
	/** 수동 새로고침 버튼 핸들러. */
	onRefresh?: () => void;
	onBackToHome?: () => void;
}

export function ProgressPageView({
	data,
	onRefresh,
	onBackToHome,
}: ProgressPageViewProps) {
	const [period, setPeriod] = useState<PeriodFilter>("today");

	const navItems: BackNavItem[] = [];
	if (onBackToHome)
		navItems.push({ icon: "home", label: "홈으로", onClick: onBackToHome });

	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-5xl space-y-6">
				{navItems.length > 0 && <BackNav items={navItems} />}
				<Header
					projectName={data.projectName}
					lastUpdated={data.lastUpdated}
					onRefresh={onRefresh}
				/>

				<PeriodTabs active={period} onChange={setPeriod} />

				<TeamSummaryBanner
					team={data.team}
					periodLabel={period === "today" ? data.period.label : "이번 주"}
				/>

				<section className="space-y-3">
					<h2 className="text-sm font-semibold text-text-muted">
						멤버별 활동 ({data.members.length}명)
					</h2>
					<div className="space-y-4">
						{data.members.map((m) => (
							<MemberCard key={m.id} member={m} period={period} />
						))}
					</div>
				</section>
			</div>
		</div>
	);
}

// ───────────────────────── Header ─────────────────────────

function Header({
	projectName,
	lastUpdated,
	onRefresh,
}: {
	projectName: string;
	lastUpdated: string;
	onRefresh?: () => void;
}) {
	const lastUpdatedRelative = useMemo(
		() => formatRelative(lastUpdated),
		[lastUpdated],
	);

	return (
		<header className="flex items-start justify-between">
			<div>
				<p className="text-xs uppercase tracking-wide text-text-faint">
					{projectName}
				</p>
				<h1 className="mt-1 text-2xl font-bold text-text-normal">
					📈 팀 진행도
				</h1>
				<p className="mt-1 text-xs text-text-muted">
					매일 자정 자동 갱신 · 마지막 갱신 {lastUpdatedRelative}
				</p>
			</div>
			<Button variant="secondary" size="sm" onClick={onRefresh}>
				<RefreshCw className="mr-1 h-3.5 w-3.5" />
				새로고침
			</Button>
		</header>
	);
}

// ───────────────────────── Period Tabs ─────────────────────────

function PeriodTabs({
	active,
	onChange,
}: {
	active: PeriodFilter;
	onChange: (p: PeriodFilter) => void;
}) {
	return (
		<div className="inline-flex rounded-md border border-bg-modifier bg-bg-secondary p-1">
			<TabButton
				active={active === "today"}
				onClick={() => onChange("today")}
				label="오늘"
			/>
			<TabButton
				active={active === "week"}
				onClick={() => onChange("week")}
				label="이번 주"
			/>
		</div>
	);
}

function TabButton({
	active,
	onClick,
	label,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
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
		</button>
	);
}

// ───────────────────────── Team Summary ─────────────────────────

function TeamSummaryBanner({
	team,
	periodLabel,
}: {
	team: TeamProgressSummary;
	periodLabel: string;
}) {
	return (
		<Card className="border-none bg-gradient-to-br from-[color:var(--interactive-accent)]/10 to-[color:var(--interactive-accent)]/5">
			<CardContent className="flex items-center justify-between p-6">
				<div>
					<p className="text-xs font-medium text-text-muted">
						팀 전체 · {periodLabel}
					</p>
					<p className="mt-1 text-lg font-semibold text-text-normal">
						활동 중인 멤버 {team.activeMembers}/{team.totalMembers}명
					</p>
				</div>
				<div className="flex gap-8">
					<SummaryStat
						icon={<CheckCircle2 className="h-5 w-5 text-[color:var(--color-green)]" />}
						value={team.totalChecks}
						label="체크 완료"
					/>
					<SummaryStat
						icon={<GitCommit className="h-5 w-5 text-[color:var(--color-blue)]" />}
						value={team.totalCommits}
						label="커밋"
					/>
					<SummaryStat
						icon={<Users2 className="h-5 w-5 text-[color:var(--interactive-accent)]" />}
						value={`${team.activeMembers}/${team.totalMembers}`}
						label="활동 멤버"
					/>
				</div>
			</CardContent>
		</Card>
	);
}

function SummaryStat({
	icon,
	value,
	label,
}: {
	icon: React.ReactNode;
	value: number | string;
	label: string;
}) {
	return (
		<div className="flex items-center gap-3">
			{icon}
			<div>
				<p className="text-2xl font-bold leading-none text-text-normal">{value}</p>
				<p className="mt-1 text-[11px] text-text-faint">{label}</p>
			</div>
		</div>
	);
}

// ───────────────────────── Member Card ─────────────────────────

function MemberCard({
	member,
	period,
}: {
	member: MemberProgressDetail;
	period: PeriodFilter;
}) {
	const [expanded, setExpanded] = useState<boolean>(false);

	const checks =
		period === "today" ? member.stats.checksToday : member.stats.checksThisWeek;
	const commits =
		period === "today" ? member.stats.commitsToday : member.stats.commitsThisWeek;

	// period에 맞게 활동 필터링
	const filteredActivities = useMemo(() => {
		if (period === "today") {
			return member.recentActivity.filter((a) => isSameDay(a.timestamp, new Date()));
		}
		// week
		const weekRange = getCurrentWeekRange(new Date());
		return member.recentActivity.filter((a) =>
			isWithinRange(a.timestamp, weekRange.start, weekRange.end),
		);
	}, [member.recentActivity, period]);

	const isInactive = checks === 0 && commits === 0;
	const color = avatarColor(member.id);

	return (
		<Card className={cn(isInactive && "opacity-60")}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div
							className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
							style={{ backgroundColor: color }}
						>
							{member.name[0]}
						</div>
						<div>
							<p className="flex items-center gap-2 text-sm font-semibold text-text-normal">
								{member.name}
								<span
									className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
									style={{
										backgroundColor: color + "22",
										color,
									}}
								>
									{member.role}
								</span>
							</p>
							{isInactive && (
								<p className="mt-0.5 text-[11px] text-text-faint">
									이 기간 활동 없음
								</p>
							)}
						</div>
					</div>

					<div className="flex items-center gap-4 text-xs">
						<StatPill
							icon="✅"
							value={checks}
							tone={checks > 0 ? "green" : "muted"}
						/>
						<StatPill
							icon="💻"
							value={commits}
							tone={commits > 0 ? "blue" : "muted"}
						/>
					</div>
				</div>
			</CardHeader>

			{!isInactive && (
				<CardContent className="space-y-4">
					{member.narrative && <NarrativeBlock text={member.narrative} />}

					{filteredActivities.length > 0 && (
						<div>
							{period === "today" ? (
								<FlatActivityList
									activities={filteredActivities}
									expanded={expanded}
									onToggleExpand={() => setExpanded((v) => !v)}
								/>
							) : (
								<GroupedActivityList
									activities={filteredActivities}
									expanded={expanded}
									onToggleExpand={() => setExpanded((v) => !v)}
								/>
							)}
						</div>
					)}
				</CardContent>
			)}
		</Card>
	);
}

/** "오늘" 탭: 시간 역순 평면 리스트. */
function FlatActivityList({
	activities,
	expanded,
	onToggleExpand,
}: {
	activities: ActivityItem[];
	expanded: boolean;
	onToggleExpand: () => void;
}) {
	const visible = expanded ? activities : activities.slice(0, 3);
	return (
		<div>
			<p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
				최근 활동
			</p>
			<ol className="space-y-2">
				{visible.map((a, i) => (
					<ActivityRow key={i} activity={a} />
				))}
			</ol>
			{activities.length > 3 && (
				<button
					onClick={onToggleExpand}
					className="mt-3 text-xs font-medium text-[color:var(--interactive-accent)] hover:underline"
				>
					{expanded
						? "접기 ↑"
						: `+ ${activities.length - 3}개 더 보기 ↓`}
				</button>
			)}
		</div>
	);
}

/** "이번 주" 탭: 날짜별 그룹핑. */
function GroupedActivityList({
	activities,
	expanded,
	onToggleExpand,
}: {
	activities: ActivityItem[];
	expanded: boolean;
	onToggleExpand: () => void;
}) {
	// 날짜(YYYY-MM-DD)별 그룹핑, 최신 날짜부터
	const groups = useMemo(() => {
		const map = new Map<string, ActivityItem[]>();
		for (const a of activities) {
			const date = a.timestamp.slice(0, 10);
			if (!map.has(date)) map.set(date, []);
			map.get(date)!.push(a);
		}
		return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
	}, [activities]);

	const visibleGroups = expanded ? groups : groups.slice(0, 2);
	const hiddenCount = groups.length - visibleGroups.length;

	return (
		<div>
			<p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
				최근 활동 ({groups.length}일)
			</p>
			<div className="space-y-4">
				{visibleGroups.map(([date, items]) => (
					<DayGroup key={date} date={date} activities={items} />
				))}
			</div>
			{hiddenCount > 0 && (
				<button
					onClick={onToggleExpand}
					className="mt-3 text-xs font-medium text-[color:var(--interactive-accent)] hover:underline"
				>
					+ 이전 {hiddenCount}일 더 보기 ↓
				</button>
			)}
			{expanded && groups.length > 2 && (
				<button
					onClick={onToggleExpand}
					className="mt-3 text-xs font-medium text-[color:var(--interactive-accent)] hover:underline"
				>
					접기 ↑
				</button>
			)}
		</div>
	);
}

function DayGroup({
	date,
	activities,
}: {
	date: string;
	activities: ActivityItem[];
}) {
	const d = new Date(date + "T00:00:00");
	const isToday = isSameDay(date, new Date());
	const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()]!;
	const label = `${weekday} ${date.slice(5)}${isToday ? " · 오늘" : ""}`;

	return (
		<div>
			<div className="mb-2 flex items-center gap-2">
				<span
					className={cn(
						"text-xs font-semibold",
						isToday ? "text-[color:var(--interactive-accent)]" : "text-text-muted",
					)}
				>
					📅 {label}
				</span>
				<span className="text-[10px] text-text-faint">· {activities.length}건</span>
			</div>
			<ol className="space-y-2 border-l-2 border-bg-modifier pl-4">
				{activities.map((a, i) => (
					<ActivityRow key={i} activity={a} />
				))}
			</ol>
		</div>
	);
}

function StatPill({
	icon,
	value,
	tone,
}: {
	icon: string;
	value: number;
	tone: "green" | "blue" | "muted";
}) {
	const toneClass = {
		green: "text-[color:var(--color-green)]",
		blue: "text-[color:var(--color-blue)]",
		muted: "text-text-faint",
	}[tone];

	return (
		<span className={cn("flex items-center gap-1 font-semibold", toneClass)}>
			<span>{icon}</span>
			<span>{value}</span>
		</span>
	);
}

function NarrativeBlock({ text }: { text: string }) {
	return (
		<div className="flex gap-3 rounded-md border-l-2 border-[color:var(--interactive-accent)] bg-[color:var(--interactive-accent)]/5 p-3">
			<Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--interactive-accent)]" />
			<p className="text-xs italic leading-relaxed text-text-muted">{text}</p>
		</div>
	);
}

// ───────────────────────── Activity Row ─────────────────────────

function ActivityRow({ activity }: { activity: ActivityItem }) {
	const time = formatTime(activity.timestamp);

	if (activity.type === "check") {
		return (
			<li className="flex items-start gap-3 rounded-md p-2 text-xs hover:bg-[color:var(--background-modifier-hover)]">
				<span className="mt-0.5 shrink-0 text-text-faint">{time}</span>
				<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--color-green)]" />
				<div className="flex-1">
					<p className="text-text-normal">
						<span className="font-mono text-text-accent">{activity.taskId}</span>{" "}
						{activity.taskTitle}
					</p>
					<p className="mt-0.5 text-text-muted">└ {activity.itemText}</p>
				</div>
			</li>
		);
	}

	return (
		<li className="flex items-start gap-3 rounded-md p-2 text-xs hover:bg-[color:var(--background-modifier-hover)]">
			<span className="mt-0.5 shrink-0 text-text-faint">{time}</span>
			<GitCommit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--color-blue)]" />
			<div className="flex-1 min-w-0">
				<p className="truncate text-text-normal">
					<span className="font-mono text-text-faint">{activity.sha.slice(0, 7)}</span>{" "}
					{activity.message}
				</p>
				{(activity.filesChanged !== undefined ||
					activity.linesAdded !== undefined) && (
					<p className="mt-0.5 text-text-faint">
						{activity.filesChanged !== undefined && `${activity.filesChanged}개 파일`}
						{activity.linesAdded !== undefined && (
							<>
								{" · "}
								<span className="text-[color:var(--color-green)]">
									+{activity.linesAdded}
								</span>
								{activity.linesRemoved !== undefined && (
									<>
										{" "}
										<span className="text-[color:var(--color-red)]">
											-{activity.linesRemoved}
										</span>
									</>
								)}
							</>
						)}
					</p>
				)}
			</div>
		</li>
	);
}

// ───────────────────────── Helpers ─────────────────────────

function formatTime(iso: string): string {
	const d = new Date(iso);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${hh}:${mm}`;
}

function isSameDay(isoOrDate: string | Date, ref: Date): boolean {
	const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
	return (
		d.getFullYear() === ref.getFullYear() &&
		d.getMonth() === ref.getMonth() &&
		d.getDate() === ref.getDate()
	);
}

/**
 * 기준일이 포함된 주의 시작(일요일 00:00) ~ 끝(토요일 24:00) 범위를 반환.
 * Pharos 주 정의: 일요일 시작 (전통 달력).
 */
function getCurrentWeekRange(ref: Date): { start: Date; end: Date } {
	const start = new Date(ref);
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - start.getDay()); // 일요일로
	const end = new Date(start);
	end.setDate(end.getDate() + 7); // 다음 주 일요일 00:00 (exclusive)
	return { start, end };
}

function isWithinRange(iso: string, start: Date, end: Date): boolean {
	const t = new Date(iso).getTime();
	return t >= start.getTime() && t < end.getTime();
}

function formatRelative(iso: string): string {
	const now = Date.now();
	const then = new Date(iso).getTime();
	const diff = Math.max(0, now - then);
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "방금 전";
	if (mins < 60) return `${mins}분 전`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}시간 전`;
	const days = Math.floor(hrs / 24);
	return `${days}일 전`;
}
