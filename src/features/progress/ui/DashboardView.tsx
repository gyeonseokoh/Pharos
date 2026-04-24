/**
 * Dashboard — Pharos 홈 화면.
 *
 * 순수 프레젠테이션 컴포넌트.
 *   - 데이터는 props(`data`)로만 받는다. 안에 하드코딩된 값 없음.
 *   - 오늘: `DashboardItemView`가 `mockDashboardData`를 주입.
 *   - 미래: 같은 ItemView가 `progressService.getSummary()` 결과를 주입. 이 파일은 무변경.
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
import type {
	DashboardAlert,
	DashboardData,
	ImportantDate,
	MemberActivity,
	MyTasksSummary,
	PhaseProgress,
	ProgressSummary,
	ProjectSummary,
	UpcomingMeeting,
} from "../domain/dashboardData";

// ───────────────────────── Component ─────────────────────────

export interface DashboardViewProps {
	data: DashboardData;
	/** 로드맵 탭으로 이동. DashboardItemView가 Obsidian workspace API를 주입. */
	onOpenRoadmap?: () => void;
	onOpenCalendar?: () => void;
	onOpenMeetings?: () => void;
	onOpenMyTasks?: () => void;
	onOpenProgress?: () => void;
	onOpenTeam?: () => void;
	onOpenSettings?: () => void;
	onGenerateMeetingTopics?: () => void;
}

export function DashboardView({
	data,
	onOpenRoadmap,
	onOpenCalendar,
	onOpenMeetings,
	onOpenMyTasks,
	onOpenProgress,
	onOpenTeam,
	onOpenSettings,
	onGenerateMeetingTopics,
}: DashboardViewProps) {
	const progressPercent = useMemo(
		() =>
			data.progress.totalTasks === 0
				? 0
				: Math.round(
						(data.progress.completedTasks / data.progress.totalTasks) * 100,
					),
		[data.progress.totalTasks, data.progress.completedTasks],
	);

	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-5xl space-y-6">
				<Header projectName={data.project.name} />

				<StatGrid
					progressPercent={progressPercent}
					progress={data.progress}
					myTasks={data.myTasks}
					project={data.project}
				/>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2 space-y-6">
						<ProgressCard
							prototypeProgress={data.prototypeProgress}
							developmentProgress={data.developmentProgress}
						/>
						<MemberActivityCard members={data.members} />
					</div>
					<div className="space-y-6">
						<UpcomingMeetingsCard
							meetings={data.meetings}
							onOpenMeetings={onOpenMeetings}
						/>
						<ImportantDatesCard dates={data.importantDates} />
						<AlertsCard alerts={data.alerts} />
					</div>
				</div>

				<QuickActions
					onOpenRoadmap={onOpenRoadmap}
					onOpenCalendar={onOpenCalendar}
					onOpenMeetings={onOpenMeetings}
					onOpenMyTasks={onOpenMyTasks}
					onOpenProgress={onOpenProgress}
					onOpenTeam={onOpenTeam}
					onOpenSettings={onOpenSettings}
					onGenerateMeetingTopics={onGenerateMeetingTopics}
				/>
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

function StatGrid({
	progressPercent,
	progress,
	myTasks,
	project,
}: {
	progressPercent: number;
	progress: ProgressSummary;
	myTasks: MyTasksSummary;
	project: ProjectSummary;
}) {
	const stats: StatProps[] = [
		{
			label: "전체 진척도",
			value: `${progressPercent}%`,
			sub: `${progress.completedTasks}/${progress.totalTasks} 체크`,
			icon: CheckCircle2,
			tone: progressPercent >= 50 ? "success" : "warning",
		},
		{
			label: "이번 주 커밋",
			value: `${progress.thisWeekCommits}`,
			sub: "전체 팀원 합계",
			icon: GitCommit,
		},
		{
			label: "내 진행 중 Task",
			value: `${myTasks.inProgress} / ${myTasks.total}`,
			sub: `${myTasks.memberName}의 담당 업무`,
			icon: Users2,
		},
		{
			label: "프로토타입 마감",
			value:
				project.daysUntilPrototype !== null
					? `D-${project.daysUntilPrototype}`
					: "—",
			sub: project.deadline,
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

function ProgressCard({
	prototypeProgress,
	developmentProgress,
}: {
	prototypeProgress: PhaseProgress | null;
	developmentProgress: PhaseProgress;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>📊 진척도</CardTitle>
				<CardDescription>
					프로토타입·전체 개발 범위의 체크리스트 완료 비율
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{prototypeProgress && (
					<ProgressRow
						label="프로토타입"
						dday={prototypeProgress.dday}
						percent={prototypeProgress.percent}
						accent="warning"
					/>
				)}
				<ProgressRow
					label="전체 개발"
					dday={developmentProgress.dday}
					percent={developmentProgress.percent}
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

function MemberActivityCard({ members }: { members: MemberActivity[] }) {
	const maxCommits = Math.max(1, ...members.map((m) => m.commits));
	return (
		<Card>
			<CardHeader>
				<CardTitle>👥 팀원 활동 (이번 주)</CardTitle>
				<CardDescription>체크리스트 완료 + GitHub 커밋 기준</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{members.map((m) => (
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

function UpcomingMeetingsCard({
	meetings,
	onOpenMeetings,
}: {
	meetings: UpcomingMeeting[];
	onOpenMeetings?: () => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>📅 다가오는 회의</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{meetings.map((m, i) => (
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
				<Button
					variant="ghost"
					size="sm"
					className="w-full"
					onClick={onOpenMeetings}
				>
					전체 일정 →
				</Button>
			</CardContent>
		</Card>
	);
}

function ImportantDatesCard({ dates }: { dates: ImportantDate[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>🎯 중요 일정</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{dates.map((d) => (
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

function AlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>⚠️ 알림</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{alerts.map((a, i) => (
					<div
						key={i}
						className={cn(
							"flex items-start gap-2 rounded-md p-3 text-xs",
							a.severity === "danger"
								? "bg-[color:var(--color-red)]/10 text-[color:var(--color-red)]"
								: a.severity === "warning"
									? "bg-[color:var(--color-orange)]/10 text-[color:var(--color-orange)]"
									: "bg-[color:var(--color-blue)]/10 text-[color:var(--color-blue)]",
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

function QuickActions({
	onOpenRoadmap,
	onOpenCalendar,
	onOpenMeetings,
	onOpenMyTasks,
	onOpenProgress,
	onOpenTeam,
	onOpenSettings,
	onGenerateMeetingTopics,
}: {
	onOpenRoadmap?: () => void;
	onOpenCalendar?: () => void;
	onOpenMeetings?: () => void;
	onOpenMyTasks?: () => void;
	onOpenProgress?: () => void;
	onOpenTeam?: () => void;
	onOpenSettings?: () => void;
	onGenerateMeetingTopics?: () => void;
}) {
	return (
		<div className="flex flex-wrap gap-3">
			<Button onClick={onOpenRoadmap}>📊 로드맵 보기</Button>
			<Button variant="secondary" onClick={onOpenMeetings}>
				📋 회의 보기
			</Button>
			<Button variant="secondary" onClick={onOpenCalendar}>
				📅 캘린더 열기
			</Button>
			<Button variant="secondary" onClick={onOpenMyTasks}>
				✅ 내 업무 보기
			</Button>
			<Button variant="secondary" onClick={onOpenProgress}>
				📈 진행도 확인
			</Button>
			<Button variant="secondary" onClick={onOpenTeam}>
				👥 팀원 보기
			</Button>
			<Button variant="outline" onClick={onGenerateMeetingTopics}>
				🤖 AI 회의 주제 생성
			</Button>
			<Button variant="ghost" onClick={onOpenSettings}>
				⚙️ 프로젝트 설정
			</Button>
		</div>
	);
}
