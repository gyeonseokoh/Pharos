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
	Bell,
	CalendarClock,
	CheckCircle2,
	GitCommit,
	Info,
	Loader2,
	Pin,
	RefreshCw,
	Settings,
	Sparkles,
	Users2,
	XCircle,
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
	ProgressAnalysisCard,
	ProgressAnalysisCardResult,
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
	/**
	 * 특정 회의 페이지로 이동.
	 * MeetingPageItemView는 캘린더·회의 목록·회의록 관리에서 이미 사용 중이며,
	 * 대시보드에서 진입 경로를 하나 추가한 것으로 새 기능이 아니다.
	 * meeting.id가 없을 경우 onOpenMeetings(목록 전체)로 fallback해 기존 동작 유지.
	 */
	onOpenMeeting?: (meetingId: string) => void;
	onOpenMyTasks?: () => void;
	onOpenProgress?: () => void;
	onOpenTeam?: () => void;
	onOpenSettings?: () => void;
	onGenerateMeetingTopics?: () => void;
	/** PO-12 AI 진행 분석 트리거. 사용자가 "AI 분석 받기" 버튼 클릭 시 호출. */
	onAnalyzeProgress?: () => void;
}

export function DashboardView({
	data,
	onOpenRoadmap,
	onOpenCalendar,
	onOpenMeetings,
	onOpenMeeting,
	onOpenMyTasks,
	onOpenProgress,
	onOpenTeam,
	onOpenSettings,
	onGenerateMeetingTopics,
	onAnalyzeProgress,
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
				<Header projectName={data.project.name} onOpenSettings={onOpenSettings} />

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
						{data.progressAnalysis !== undefined &&
							data.progressAnalysis !== null && (
								<ProgressAnalysisCardSection
									card={data.progressAnalysis}
									onAnalyze={onAnalyzeProgress}
								/>
							)}
						<MemberActivityCard members={data.members} />
					</div>
					<div className="flex flex-col gap-6">
						<UpcomingMeetingsCard
							meetings={data.meetings}
							onOpenMeetings={onOpenMeetings}
							onOpenMeeting={onOpenMeeting}
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

function Header({
	projectName,
	onOpenSettings,
}: {
	projectName: string;
	onOpenSettings?: () => void;
}) {
	return (
		<header className="flex items-center justify-between">
			<div>
				<p className="text-xs uppercase tracking-wide text-text-faint">
					Pharos Dashboard
				</p>
				<h1 className="mt-1 text-2xl font-bold text-text-normal">{projectName}</h1>
			</div>
			<div className="flex items-center gap-1">
				<Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="새로고침">
					<RefreshCw className="h-4 w-4 text-text-muted" />
				</Button>
				<Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="프로젝트 설정" onClick={onOpenSettings}>
					<Settings className="h-4 w-4 text-text-muted" />
				</Button>
			</div>
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

// ───────────────────────── Progress Analysis Card (PO-12) ─────────────────────────

function ProgressAnalysisCardSection({
	card,
	onAnalyze,
}: {
	card: ProgressAnalysisCard;
	onAnalyze?: () => void;
}) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-[color:var(--interactive-accent)]" />
					<CardTitle className="text-sm">AI 진행 분석</CardTitle>
					{card.result && <HealthBadge health={card.result.overallHealth} />}
				</div>
				{card.result && !card.loading && onAnalyze && (
					<Button variant="ghost" size="sm" onClick={onAnalyze}>
						<RefreshCw className="h-3 w-3" />
						다시 분석
					</Button>
				)}
			</CardHeader>
			<CardContent>
				{card.loading ? (
					<div className="flex items-center gap-2 text-xs text-text-muted">
						<Loader2 className="h-4 w-4 animate-spin" />
						AI 가 프로젝트 상태를 분석 중...
					</div>
				) : card.error ? (
					<div className="space-y-2">
						<p className="text-xs text-[color:var(--color-red)]">
							분석 실패: {card.error}
						</p>
						{onAnalyze && (
							<Button variant="outline" size="sm" onClick={onAnalyze}>
								<Sparkles className="h-3 w-3" />
								다시 시도
							</Button>
						)}
					</div>
				) : card.result ? (
					<ProgressAnalysisBody result={card.result} />
				) : (
					<div className="flex flex-col items-start gap-2">
						<p className="text-xs text-text-muted">
							Task·체크리스트·커밋 검증을 종합해 프로젝트 건강도를 진단합니다.
						</p>
						{onAnalyze && (
							<Button variant="secondary" onClick={onAnalyze}>
								<Sparkles className="mr-2 h-3.5 w-3.5" />
								AI 분석 받기
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function HealthBadge({
	health,
}: {
	health: ProgressAnalysisCardResult["overallHealth"];
}) {
	const config = {
		"on-track": {
			label: "순조",
			class:
				"bg-[color:var(--color-green)]/15 text-[color:var(--color-green)]",
		},
		"at-risk": {
			label: "주의",
			class:
				"bg-[color:var(--color-orange)]/15 text-[color:var(--color-orange)]",
		},
		critical: {
			label: "심각",
			class: "bg-[color:var(--color-red)]/15 text-[color:var(--color-red)]",
		},
	}[health];
	return (
		<span
			className={cn(
				"rounded-full px-2 py-0.5 text-[10px] font-semibold",
				config.class,
			)}
		>
			{config.label}
		</span>
	);
}

function ProgressAnalysisBody({
	result,
}: {
	result: ProgressAnalysisCardResult;
}) {
	return (
		<div className="space-y-3">
			<p className="text-xs leading-relaxed text-text-normal">{result.summary}</p>
			{result.insights.length > 0 && (
				<ul className="space-y-1.5">
					{result.insights.map((ins, i) => (
						<li
							key={i}
							className="flex items-start gap-2 rounded-md border border-bg-modifier bg-bg-secondary px-2.5 py-1.5"
						>
							<InsightIcon type={ins.type} />
							<span className="text-[11px] text-text-muted">{ins.message}</span>
						</li>
					))}
				</ul>
			)}
			<p className="text-[10px] text-text-faint">분석 시점 · {result.asOf}</p>
		</div>
	);
}

function InsightIcon({
	type,
}: {
	type: ProgressAnalysisCardResult["insights"][number]["type"];
}) {
	const map = {
		milestone: { Icon: CheckCircle2, color: "text-[color:var(--color-green)]" },
		risk: { Icon: AlertTriangle, color: "text-[color:var(--color-orange)]" },
		achievement: { Icon: CheckCircle2, color: "text-[color:var(--color-green)]" },
		recommendation: { Icon: Info, color: "text-[color:var(--interactive-accent)]" },
	}[type];
	const { Icon, color } = map;
	return <Icon className={cn("mt-0.5 h-3 w-3 shrink-0", color)} />;
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

/**
 * 다가오는 회의 카드.
 * 최대 2건만 표시해 카드 높이를 제한한다.
 * 3건 이상이면 "외 N건 더" 텍스트로 나머지 수를 안내하고 전체 일정 버튼으로 유도.
 */
function UpcomingMeetingsCard({
	meetings,
	onOpenMeetings,
	onOpenMeeting,
}: {
	meetings: UpcomingMeeting[];
	onOpenMeetings?: () => void;
	onOpenMeeting?: (meetingId: string) => void;
}) {
	const VISIBLE = 1;
	const visible = meetings.slice(0, VISIBLE);
	const remaining = meetings.length - VISIBLE;

	return (
		<Card>
			<CardHeader>
				<CardTitle>📅 다가오는 회의</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{visible.map((m, i) => (
					<div
						key={i}
						// id가 있으면 해당 회의 페이지로, 없으면 목록으로 이동
						className="flex items-start gap-3 rounded-md p-2 hover:bg-[color:var(--background-modifier-hover)] cursor-pointer"
						onClick={() =>
							m.id ? onOpenMeeting?.(m.id) : onOpenMeetings?.()
						}
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

/**
 * 중요 일정 행.
 * D-day 긴박도에 따라 색상을 달리 해 항목 간 구분을 명확히 한다.
 *   - D-7 이내  : 빨강 (위험)
 *   - D-21 이내 : 주황 (주의)
 *   - 그 외     : 파랑 (안정)
 * 알림 카드와 동일하게 color-mix() 인라인 스타일로 반투명 배경·왼쪽 보더 적용.
 */
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
		<div className="flex items-center justify-between rounded-md p-2">
			<p className="flex items-center gap-1.5 text-sm font-medium text-text-normal">
				<Pin className="h-3.5 w-3.5 shrink-0 fill-current text-[color:var(--color-yellow)]" />
				{label}
			</p>
			<div className="flex items-center gap-2 text-xs">
				<span className="text-text-faint">{date}</span>
				<span className={cn("font-semibold", ddayTone)}>D-{dday}</span>
			</div>
		</div>
	);
}

/**
 * 알림 카드.
 * 기존: 삼각 아이콘 + 텍스트만 나열 → severity 구분이 안 되고 밋밋함.
 * 개선:
 *   - severity별 전용 아이콘 (XCircle: danger, AlertTriangle: warning, Info: info)
 *   - 왼쪽 컬러 보더 스트라이프로 시각적 구분
 *   - 배지 라벨("긴급" / "주의" / "정보")로 유형 명시
 *   - 미세한 그림자로 입체감 부여
 */
function AlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
	return (
		<Card className="flex flex-col flex-1">
			<CardHeader className="pb-2 pt-3 px-4">
				<CardTitle className="flex items-center gap-2">
					<Bell className="h-4 w-4 fill-current text-[color:var(--color-yellow)]" />
					알림
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 px-4 pb-3 pt-0">
				{alerts.map((a, i) => (
					<AlertItem key={i} alert={a} />
				))}
			</CardContent>
		</Card>
	);
}

/**
 * severity에 따라 아이콘·색상·라벨이 달라지는 개별 알림 아이템.
 *
 * Tailwind의 opacity modifier(/8, /15)는 빌드 시점에 색상 포맷을 알 수 없으면
 * 클래스를 생성하지 않아서, CSS 변수를 쓰는 반투명 배경엔 적용되지 않는다.
 * → 배경/그림자/보더를 모두 color-mix() 인라인 스타일로 처리.
 */
function AlertItem({ alert }: { alert: DashboardAlert }) {
	const config = {
		danger: {
			Icon: XCircle,
			label: "긴급",
			color: "var(--color-red)",
			textClass: "text-[color:var(--color-red)]",
		},
		warning: {
			Icon: AlertTriangle,
			label: "주의",
			color: "var(--color-orange)",
			textClass: "text-[color:var(--color-orange)]",
		},
		info: {
			Icon: Info,
			label: "정보",
			color: "var(--color-blue)",
			textClass: "text-[color:var(--color-blue)]",
		},
	}[alert.severity];

	const { Icon } = config;
	const c = config.color;

	return (
		<div
			className="flex items-start gap-2 rounded-md p-1.5"
			style={{
				backgroundColor: `color-mix(in srgb, ${c} 8%, transparent)`,
				borderRight: `3px solid ${c}`,
				boxShadow: `0 1px 4px color-mix(in srgb, ${c} 18%, transparent)`,
			}}
		>
			<Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", config.textClass)} />
			<div className="min-w-0 flex-1">
				<span
					className="mb-0.5 inline-block rounded-full px-1.5 py-0 text-[10px] font-bold"
					style={{
						backgroundColor: `color-mix(in srgb, ${c} 15%, transparent)`,
						color: c,
					}}
				>
					{config.label}
				</span>
				<p className={cn("text-xs leading-relaxed", config.textClass)}>
					{alert.text}
				</p>
			</div>
		</div>
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
			<Button variant="secondary" onClick={onOpenRoadmap}>📊 로드맵 보기</Button>
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
		</div>
	);
}
