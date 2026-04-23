/**
 * MeetingPageView — 회의 상세 페이지.
 *
 * 포함 영역:
 *   - 회의 정보 (일시·유형·참석자)
 *   - 🎯 회의 주제 (PO-2)
 *   - 📎 수집 자료 (PO-3)
 *   - 📝 회의록 (PO-5, 사용자 직접 작성)
 *   - ✨ AI 분석 (키워드·기술스택·결정사항, 회의록 작성 후 자동 생성)
 *
 * 순수 프레젠테이션. 데이터는 props(`data`)로 주입.
 */

import {
	ArrowLeft,
	CheckCircle2,
	ExternalLink,
	FileText,
	Pencil,
	Sparkles,
	Users,
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
import type { MeetingType } from "../domain/calendarData";
import type {
	MeetingAnalysis,
	MeetingAttendee,
	MeetingMinutes,
	MeetingPageData,
	MeetingResource,
	MeetingStatus,
	MeetingTopic,
} from "../domain/meetingPageData";

export interface MeetingPageViewProps {
	data: MeetingPageData;
	/** 캘린더로 돌아가기. */
	onBack?: () => void;
	/** "AI 주제 생성" 버튼. */
	onGenerateTopics?: () => void;
	/** "회의록 작성하기" 버튼. */
	onEditMinutes?: () => void;
}

export function MeetingPageView({
	data,
	onBack,
	onGenerateTopics,
	onEditMinutes,
}: MeetingPageViewProps) {
	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-3xl space-y-6">
				{onBack && (
					<div
						onClick={onBack}
						role="button"
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onBack();
							}
						}}
						className="inline-flex cursor-pointer items-center gap-1 text-xs text-text-muted hover:text-text-normal"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						<span>캘린더로 돌아가기</span>
					</div>
				)}

				<Header data={data} />

				<InfoBar data={data} />

				<TopicsSection
					topics={data.topics}
					status={data.status}
					onGenerateTopics={onGenerateTopics}
				/>

				<ResourcesSection
					resources={data.resources}
					topics={data.topics}
				/>

				<MinutesSection minutes={data.minutes} onEditMinutes={onEditMinutes} />

				<AnalysisSection analysis={data.analysis} hasMinutes={data.minutes !== null} />
			</div>
		</div>
	);
}

// ───────────────────────── Header ─────────────────────────

function Header({ data }: { data: MeetingPageData }) {
	const typeLabel = data.type === "regular" ? "정기 회의" : "임시 회의";
	const typeClass =
		data.type === "regular"
			? "bg-[color:var(--interactive-accent)]/15 text-[color:var(--interactive-accent)]"
			: "bg-[color:var(--color-orange)]/15 text-[color:var(--color-orange)]";

	const weekday = ["일", "월", "화", "수", "목", "금", "토"][
		new Date(data.date + "T00:00:00").getDay()
	]!;

	return (
		<header className="space-y-2">
			<div className="flex items-center gap-2 text-xs">
				<span
					className={cn(
						"rounded-full px-2 py-0.5 font-medium",
						typeClass,
					)}
				>
					{typeLabel}
				</span>
				<StatusBadge status={data.status} />
			</div>
			<h1 className="text-2xl font-bold text-text-normal">{data.title}</h1>
			<p className="text-sm text-text-muted">
				{data.date} ({weekday}) · {data.time} · {data.durationMinutes}분
			</p>
		</header>
	);
}

function StatusBadge({ status }: { status: MeetingStatus }) {
	const config = {
		topic_pending: {
			label: "주제 준비 중",
			class: "bg-bg-modifier text-text-muted",
		},
		ready: {
			label: "준비 완료",
			class:
				"bg-[color:var(--color-blue)]/15 text-[color:var(--color-blue)]",
		},
		completed: {
			label: "완료",
			class:
				"bg-[color:var(--color-green)]/15 text-[color:var(--color-green)]",
		},
	}[status];

	return (
		<span className={cn("rounded-full px-2 py-0.5 font-medium", config.class)}>
			{config.label}
		</span>
	);
}

// ───────────────────────── Info Bar ─────────────────────────

function InfoBar({ data }: { data: MeetingPageData }) {
	const attendedCount = data.attendees.filter((a) => a.attended === true).length;
	const totalAttendees = data.attendees.length;

	return (
		<Card>
			<CardContent className="flex flex-wrap gap-6 p-4 text-xs">
				<AttendeesInfo
					attendees={data.attendees}
					attendedCount={attendedCount}
					totalAttendees={totalAttendees}
					status={data.status}
				/>

				<div className="flex items-center gap-2 text-text-muted">
					<span>🎯 주제 {data.topics.length}개</span>
				</div>
				<div className="flex items-center gap-2 text-text-muted">
					<span>📎 자료 {data.resources.length}건</span>
				</div>
			</CardContent>
		</Card>
	);
}

function AttendeesInfo({
	attendees,
	attendedCount,
	totalAttendees,
	status,
}: {
	attendees: MeetingAttendee[];
	attendedCount: number;
	totalAttendees: number;
	status: MeetingStatus;
}) {
	const label =
		status === "completed"
			? `참석 ${attendedCount}/${totalAttendees}명`
			: `초대 ${totalAttendees}명`;

	return (
		<div className="flex items-center gap-2">
			<Users className="h-4 w-4 text-text-muted" />
			<div className="flex items-center gap-1">
				{attendees.slice(0, 5).map((a) => (
					<span
						key={a.id}
						className={cn(
							"flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
							a.attended === false && "opacity-40",
						)}
						style={{ backgroundColor: hashColor(a.id) }}
						title={`${a.name} (${a.role})${a.attended === false ? " · 불참" : ""}`}
					>
						{a.name[0]}
					</span>
				))}
				{attendees.length > 5 && (
					<span className="text-[10px] text-text-faint">
						+{attendees.length - 5}
					</span>
				)}
			</div>
			<span className="text-text-muted">· {label}</span>
		</div>
	);
}

// ───────────────────────── Topics Section ─────────────────────────

function TopicsSection({
	topics,
	status,
	onGenerateTopics,
}: {
	topics: MeetingTopic[];
	status: MeetingStatus;
	onGenerateTopics?: () => void;
}) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>🎯 회의 주제</CardTitle>
						<CardDescription>
							{topics.length > 0
								? `${topics.length}개 주제 준비됨`
								: "아직 주제가 없습니다"}
						</CardDescription>
					</div>
					{status !== "completed" && (
						<Button variant="outline" size="sm" onClick={onGenerateTopics}>
							<Sparkles className="mr-1 h-3.5 w-3.5" />
							AI로 주제 생성
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{topics.length === 0 ? (
					<div className="py-6 text-center text-xs text-text-muted">
						"AI로 주제 생성" 버튼을 눌러 주제를 받거나, 직접 추가하세요.
					</div>
				) : (
					<ol className="space-y-3">
						{topics
							.sort((a, b) => a.priority - b.priority)
							.map((t, i) => (
								<TopicRow key={t.id} topic={t} index={i + 1} />
							))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

function TopicRow({ topic, index }: { topic: MeetingTopic; index: number }) {
	return (
		<li className="flex gap-3">
			<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-modifier text-[11px] font-bold text-text-muted">
				{index}
			</span>
			<div className="flex-1 space-y-1">
				<div className="flex items-start justify-between gap-2">
					<p className="text-sm font-medium text-text-normal">{topic.title}</p>
					{topic.source === "AI" && (
						<span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[color:var(--interactive-accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--interactive-accent)]">
							<Sparkles className="h-2.5 w-2.5" />
							AI 제안
						</span>
					)}
				</div>
				{topic.description && (
					<p className="text-xs text-text-muted">{topic.description}</p>
				)}
				{topic.reason && (
					<p className="text-[11px] italic text-text-faint">
						💭 {topic.reason}
					</p>
				)}
			</div>
		</li>
	);
}

// ───────────────────────── Resources Section ─────────────────────────

function ResourcesSection({
	resources,
	topics,
}: {
	resources: MeetingResource[];
	topics: MeetingTopic[];
}) {
	const topicTitle = (id: string | null): string =>
		id ? (topics.find((t) => t.id === id)?.title ?? "기타") : "전체 공용";

	// 주제별로 그룹핑
	const grouped = resources.reduce<Record<string, MeetingResource[]>>(
		(acc, r) => {
			const key = r.topicId ?? "__general__";
			if (!acc[key]) acc[key] = [];
			acc[key]!.push(r);
			return acc;
		},
		{},
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>📎 수집 자료</CardTitle>
				<CardDescription>
					{resources.length > 0
						? `${resources.length}건 수집됨 · AI가 각 주제별로 자동 조사`
						: "아직 자료가 없습니다"}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				{resources.length === 0 ? (
					<div className="py-6 text-center text-xs text-text-muted">
						주제가 확정되면 AI가 자동으로 자료를 수집합니다.
					</div>
				) : (
					Object.entries(grouped).map(([topicId, items]) => (
						<div key={topicId} className="space-y-2">
							<p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
								{topicTitle(topicId === "__general__" ? null : topicId)}
							</p>
							<div className="space-y-2">
								{items.map((r) => (
									<ResourceRow key={r.id} resource={r} />
								))}
							</div>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

function ResourceRow({ resource }: { resource: MeetingResource }) {
	return (
		<div className="rounded-md border border-bg-modifier p-3">
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm font-medium text-text-normal">{resource.title}</p>
				<a
					href={resource.sourceUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="flex shrink-0 items-center gap-0.5 text-[11px] text-[color:var(--interactive-accent)] hover:underline"
					onClick={(e) => e.stopPropagation()}
				>
					원문
					<ExternalLink className="h-3 w-3" />
				</a>
			</div>
			<p className="mt-1 text-xs leading-relaxed text-text-muted">
				{resource.summary}
			</p>
		</div>
	);
}

// ───────────────────────── Minutes Section ─────────────────────────

function MinutesSection({
	minutes,
	onEditMinutes,
}: {
	minutes: MeetingMinutes | null;
	onEditMinutes?: () => void;
}) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>📝 회의록</CardTitle>
						<CardDescription>
							{minutes
								? `${minutes.authorName} · ${formatDateTime(minutes.writtenAt)}`
								: "회의 후 작성해주세요"}
						</CardDescription>
					</div>
					<Button variant="secondary" size="sm" onClick={onEditMinutes}>
						<Pencil className="mr-1 h-3.5 w-3.5" />
						{minutes ? "편집" : "작성하기"}
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{minutes ? (
					<pre className="whitespace-pre-wrap rounded-md bg-bg-primary p-4 text-xs leading-relaxed text-text-normal">
						{minutes.content}
					</pre>
				) : (
					<div className="flex flex-col items-center gap-2 py-8 text-center">
						<FileText className="h-8 w-8 text-text-faint" />
						<p className="text-xs text-text-muted">
							아직 회의록이 작성되지 않았습니다.
						</p>
						<p className="text-[11px] text-text-faint">
							작성 후 AI가 키워드·결정사항을 자동 분석합니다.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// ───────────────────────── Analysis Section ─────────────────────────

function AnalysisSection({
	analysis,
	hasMinutes,
}: {
	analysis: MeetingAnalysis | null;
	hasMinutes: boolean;
}) {
	if (!hasMinutes) {
		return (
			<Card className="border-dashed">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-text-faint">
						<Sparkles className="h-4 w-4" />
						AI 분석
					</CardTitle>
					<CardDescription>
						회의록이 작성되면 자동으로 생성됩니다
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	if (!analysis) {
		return (
			<Card>
				<CardContent className="py-6 text-center text-xs text-text-muted">
					AI가 회의록을 분석 중입니다...
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="border-[color:var(--interactive-accent)]/30 bg-[color:var(--interactive-accent)]/5">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-[color:var(--interactive-accent)]" />
					AI 분석 결과
				</CardTitle>
				<CardDescription>
					{formatDateTime(analysis.analyzedAt)} 생성됨
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4 text-xs">
				<div>
					<p className="mb-1 font-semibold text-text-normal">요약</p>
					<p className="leading-relaxed text-text-muted">{analysis.summary}</p>
				</div>

				{analysis.decisions.length > 0 && (
					<div>
						<p className="mb-1 font-semibold text-text-normal">결정사항</p>
						<ul className="space-y-1">
							{analysis.decisions.map((d, i) => (
								<li key={i} className="flex gap-2 text-text-muted">
									<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--color-green)]" />
									<span>{d}</span>
								</li>
							))}
						</ul>
					</div>
				)}

				<div className="grid grid-cols-2 gap-4">
					{analysis.keywords.length > 0 && (
						<div>
							<p className="mb-1 font-semibold text-text-normal">핵심 키워드</p>
							<div className="flex flex-wrap gap-1">
								{analysis.keywords.map((k) => (
									<span
										key={k}
										className="rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] text-text-muted"
									>
										{k}
									</span>
								))}
							</div>
						</div>
					)}
					{analysis.techStacks.length > 0 && (
						<div>
							<p className="mb-1 font-semibold text-text-normal">언급된 기술스택</p>
							<div className="flex flex-wrap gap-1">
								{analysis.techStacks.map((t) => (
									<span
										key={t}
										className="rounded bg-[color:var(--color-blue)]/10 px-1.5 py-0.5 text-[10px] text-[color:var(--color-blue)]"
									>
										{t}
									</span>
								))}
							</div>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

// ───────────────────────── Helpers ─────────────────────────

function hashColor(id: string): string {
	const COLORS = [
		"#f97316",
		"#3b82f6",
		"#8b5cf6",
		"#ec4899",
		"#10b981",
		"#eab308",
		"#ef4444",
		"#06b6d4",
	];
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
	return COLORS[Math.abs(h) % COLORS.length]!;
}

function formatDateTime(iso: string): string {
	const d = new Date(iso);
	const date = `${d.getMonth() + 1}/${d.getDate()}`;
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${date} ${hh}:${mm}`;
}
