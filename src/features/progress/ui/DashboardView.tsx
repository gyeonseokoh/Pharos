/**
 * Dashboard — Pharos 홈 화면 (MOCKUP).
 *
 * 실제 데이터 연결 전에 "Obsidian 안에서 어떻게 보일지" 감 잡기 위한 목업 버전.
 * 가짜 데이터로 모든 섹션이 채워져 있음. 나중에 `progressService` 등을 주입해서 실제 값으로 교체.
 */

import { useMemo } from "react";
import {
	AlertTriangle,
	CalendarClock,
	CheckCircle2,
	GitCommit,
	Users2,
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

// ───────────────────────── Mock Data ─────────────────────────

const mockProject = {
	name: "AI 프로젝트 매니저",
	status: "DEVELOPMENT" as const,
	deadline: "2026-06-30",
	daysUntilPrototype: 14,
	totalDays: 68,
};

const mockProgress = {
	totalTasks: 30,
	completedTasks: 12,
	thisWeekCommits: 45,
	myTasksInProgress: 5,
	myTasksTotal: 8,
};

/**
 * 프로토타입이 필요한 프로젝트인지 여부.
 * - 중간 발표 데모가 있는 경우 true.
 * - 없으면 ProgressCard에서 프로토타입 진척도 행이 아예 숨겨짐.
 */
const mockHasPrototype = true;

const mockPrototypeProgress = {
	/** 프로토타입 범위 Task 완료 비율 (%). */
	percent: 40,
	/** 프로토타입 마감까지 남은 일수. */
	dday: 14,
};

const mockDevelopmentProgress = {
	/** 전체 개발 Task 완료 비율 (%). */
	percent: 25,
	/** 최종 제출까지 남은 일수. */
	dday: 68,
};

const mockImportantDates = [
	{ label: "중간발표", date: "2026-05-14", dday: 21 },
	{ label: "최종 제출", date: "2026-06-30", dday: 68 },
];

const mockMembers = [
	{ id: "m1", name: "유석", checks: 8, commits: 23, role: "PO" },
	{ id: "m2", name: "경석", checks: 5, commits: 18, role: "PM" },
	{ id: "m3", name: "수웅", checks: 3, commits: 7, role: "PM" },
	{ id: "m4", name: "동환", checks: 4, commits: 12, role: "PM" },
	{ id: "m5", name: "우덕", checks: 2, commits: 3, role: "PM" },
];

const mockMeetings = [
	{ date: "2026-04-24", time: "14:00", title: "주간 정기 회의" },
	{ date: "2026-04-26", time: "19:00", title: "기술 스택 검토" },
	{ date: "2026-04-30", time: "10:00", title: "중간발표 리허설" },
];

const mockAlerts = [
	{ severity: "danger" as const, text: "P0 미완료 Task 2건 (TASK-003, TASK-007)" },
	{ severity: "warning" as const, text: "이번 주 커밋 없는 팀원 1명: 우덕" },
];

// ───────────────────────── Component ─────────────────────────

export interface DashboardViewProps {
	/** 로드맵 탭으로 이동. DashboardItemView가 Obsidian workspace API를 주입. */
	onOpenRoadmap?: () => void;
}

export function DashboardView({ onOpenRoadmap }: DashboardViewProps = {}) {
	const progressPercent = useMemo(
		() => Math.round((mockProgress.completedTasks / mockProgress.totalTasks) * 100),
		[],
	);

	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-5xl space-y-6">
				<Header projectName={mockProject.name} />

				<StatGrid progressPercent={progressPercent} />

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2 space-y-6">
						<ProgressCard />
						<MemberActivityCard />
					</div>
					<div className="space-y-6">
						<UpcomingMeetingsCard />
						<ImportantDatesCard />
						<AlertsCard />
					</div>
				</div>

				<QuickActions onOpenRoadmap={onOpenRoadmap} />
			</div>
		</div>
	);
}

// ───────────────────────── Sub-components ─────────────────────────

function Header({ projectName }: { projectName: string }) {
	return (
		<header className="flex items-center justify-between">
			<div>
				<p className="text-xs uppercase tracking-wide text-text-faint">
					Pharos Dashboard
				</p>
				<h1 className="mt-1 text-2xl font-bold text-text-normal">{projectName}</h1>
			</div>
			<Button variant="secondary" size="sm">
				새로고침
			</Button>
		</header>
	);
}

interface StatProps {
	label: string;
	value: string;
	sub?: string;
	icon: LucideIcon;
	tone?: "default" | "success" | "warning" | "danger";
}

function StatGrid({ progressPercent }: { progressPercent: number }) {
	const stats: StatProps[] = [
		{
			label: "전체 진척도",
			value: `${progressPercent}%`,
			sub: `${mockProgress.completedTasks}/${mockProgress.totalTasks} 체크`,
			icon: CheckCircle2,
			tone: progressPercent >= 50 ? "success" : "warning",
		},
		{
			label: "이번 주 커밋",
			value: `${mockProgress.thisWeekCommits}`,
			sub: "전체 팀원 합계",
			icon: GitCommit,
		},
		{
			label: "내 진행 중 Task",
			value: `${mockProgress.myTasksInProgress} / ${mockProgress.myTasksTotal}`,
			sub: "유석의 담당 업무",
			icon: Users2,
		},
		{
			label: "프로토타입 마감",
			value: `D-${mockProject.daysUntilPrototype}`,
			sub: mockProject.deadline,
			icon: CalendarClock,
			tone: "warning",
		},
	];

	return (
		<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
			{stats.map((s) => (
				<StatCard key={s.label} {...s} />
			))}
		</div>
	);
}

function StatCard({ label, value, sub, icon: Icon, tone = "default" }: StatProps) {
	const toneClass = {
		default: "text-text-normal",
		success: "text-[color:var(--color-green)]",
		warning: "text-[color:var(--color-orange)]",
		danger: "text-[color:var(--color-red)]",
	}[tone];

	return (
		<Card>
			<CardContent className="p-5">
				<div className="flex items-start justify-between">
					<p className="text-xs font-medium text-text-muted">{label}</p>
					<Icon className={cn("h-4 w-4", toneClass)} />
				</div>
				<p className={cn("mt-2 text-2xl font-bold", toneClass)}>{value}</p>
				{sub && <p className="mt-1 text-xs text-text-faint">{sub}</p>}
			</CardContent>
		</Card>
	);
}

function ProgressCard() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>📊 진척도</CardTitle>
				<CardDescription>
					프로토타입·전체 개발 범위의 체크리스트 완료 비율
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{mockHasPrototype && (
					<ProgressRow
						label="프로토타입"
						dday={mockPrototypeProgress.dday}
						percent={mockPrototypeProgress.percent}
						accent="warning"
					/>
				)}
				<ProgressRow
					label="전체 개발"
					dday={mockDevelopmentProgress.dday}
					percent={mockDevelopmentProgress.percent}
					accent="default"
				/>
			</CardContent>
		</Card>
	);
}

function ProgressRow({
	label,
	dday,
	percent,
	accent,
}: {
	label: string;
	dday: number;
	percent: number;
	accent: "default" | "warning";
}) {
	const ddayTone =
		dday <= 7
			? "text-[color:var(--color-red)]"
			: dday <= 21
				? "text-[color:var(--color-orange)]"
				: "text-text-muted";
	const barColor =
		accent === "warning"
			? "bg-[color:var(--color-orange)]"
			: "bg-[color:var(--interactive-accent)]";
	return (
		<div className="space-y-2">
			<div className="flex items-baseline justify-between">
				<p className="text-sm font-medium text-text-normal">{label}</p>
				<div className="flex items-center gap-2 text-xs">
					<span className="font-semibold text-text-normal">{percent}%</span>
					<span className={cn("font-semibold", ddayTone)}>D-{dday}</span>
				</div>
			</div>
			<div className="h-2 overflow-hidden rounded-full bg-bg-modifier">
				<div
					className={cn("h-full transition-all", barColor)}
					style={{ width: `${percent}%` }}
				/>
			</div>
		</div>
	);
}

function ImportantDatesCard() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>🎯 중요 일정</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{mockImportantDates.map((d) => (
					<ImportantDateRow key={d.label} {...d} />
				))}
			</CardContent>
		</Card>
	);
}

function ImportantDateRow({
	label,
	date,
	dday,
}: {
	label: string;
	date: string;
	dday: number;
}) {
	const ddayTone =
		dday <= 7
			? "text-[color:var(--color-red)]"
			: dday <= 21
				? "text-[color:var(--color-orange)]"
				: "text-text-muted";
	return (
		<div className="flex items-baseline justify-between rounded-md p-2 hover:bg-[color:var(--background-modifier-hover)]">
			<p className="text-sm font-medium text-text-normal">{label}</p>
			<div className="flex items-center gap-2 text-xs">
				<span className="text-text-faint">{date}</span>
				<span className={cn("font-semibold", ddayTone)}>D-{dday}</span>
			</div>
		</div>
	);
}

function MemberActivityCard() {
	const maxCommits = Math.max(...mockMembers.map((m) => m.commits));
	return (
		<Card>
			<CardHeader>
				<CardTitle>👥 팀원 활동 (이번 주)</CardTitle>
				<CardDescription>체크리스트 완료 + GitHub 커밋 기준</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{mockMembers.map((m) => (
					<div key={m.id} className="flex items-center gap-3">
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--interactive-accent)] text-xs font-bold text-[color:var(--text-on-accent)]">
							{m.name[0]}
						</div>
						<div className="flex-1">
							<div className="flex items-baseline justify-between">
								<p className="text-sm font-medium text-text-normal">
									{m.name}{" "}
									<span className="ml-1 text-xs text-text-faint">({m.role})</span>
								</p>
								<p className="text-xs text-text-muted">
									✅ {m.checks} · 💻 {m.commits}
								</p>
							</div>
							<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-modifier">
								<div
									className="h-full bg-[color:var(--interactive-accent)]"
									style={{ width: `${(m.commits / maxCommits) * 100}%` }}
								/>
							</div>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function UpcomingMeetingsCard() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>📅 다가오는 회의</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{mockMeetings.map((m, i) => (
					<div
						key={i}
						className="flex items-start gap-3 rounded-md p-2 hover:bg-[color:var(--background-modifier-hover)] cursor-pointer"
					>
						<div className="text-center">
							<p className="text-xs font-medium text-text-muted">
								{m.date.slice(5).replace("-", "/")}
							</p>
							<p className="text-xs text-text-faint">{m.time}</p>
						</div>
						<p className="flex-1 text-sm text-text-normal">{m.title}</p>
					</div>
				))}
				<Button variant="ghost" size="sm" className="w-full">
					전체 일정 →
				</Button>
			</CardContent>
		</Card>
	);
}

function AlertsCard() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>⚠️ 알림</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{mockAlerts.map((a, i) => (
					<div
						key={i}
						className={cn(
							"flex items-start gap-2 rounded-md p-3 text-xs",
							a.severity === "danger"
								? "bg-[color:var(--color-red)]/10 text-[color:var(--color-red)]"
								: "bg-[color:var(--color-orange)]/10 text-[color:var(--color-orange)]",
						)}
					>
						<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						<p>{a.text}</p>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function QuickActions({ onOpenRoadmap }: { onOpenRoadmap?: () => void }) {
	return (
		<div className="flex flex-wrap gap-3">
			<Button onClick={onOpenRoadmap}>📊 로드맵 보기</Button>
			<Button variant="secondary">📅 캘린더 열기</Button>
			<Button variant="secondary">✅ 내 업무 보기</Button>
			<Button variant="outline">🤖 AI 회의 주제 생성</Button>
			<Button variant="ghost">⚙️ 프로젝트 설정</Button>
		</div>
	);
}
