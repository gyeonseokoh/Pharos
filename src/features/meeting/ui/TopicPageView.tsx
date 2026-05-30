/**
 * TopicPageView — 회의 주제 1건에 대한 전용 페이지.
 */

import {
	CheckCircle2,
	ExternalLink,
	MessageSquareQuote,
	Sparkles,
} from "lucide-react";
import { BackNav, type BackNavItem } from "shared/ui/BackNav";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "shared/ui/Card";
import { cn } from "shared/ui/utils";
import type { TopicPageData } from "../domain/topicPageData";
import type { MeetingResource } from "../domain/meetingPageData";

export interface TopicPageViewProps {
	data: TopicPageData;
	/** 상위 회의 페이지로. */
	onBackToMeeting?: () => void;
	/** 홈(Dashboard)으로. */
	onBackToHome?: () => void;
}

export function TopicPageView({
	data,
	onBackToMeeting,
	onBackToHome,
}: TopicPageViewProps) {
	const navItems: BackNavItem[] = [];
	if (onBackToMeeting)
		navItems.push({
			icon: "back",
			label: `${data.meeting.title}로`,
			onClick: onBackToMeeting,
		});
	if (onBackToHome)
		navItems.push({ icon: "home", label: "홈으로", onClick: onBackToHome });

	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-3xl space-y-6">
				{navItems.length > 0 && <BackNav items={navItems} />}

				<Header topic={data.topic} />

				{data.topic.reason && <ReasonCard reason={data.topic.reason} />}

				<ResourcesSection resources={data.resources} />

				{data.decisions.length > 0 && <DecisionsCard decisions={data.decisions} />}

				<MinutesExcerptCard excerpt={data.minutesExcerpt} />
			</div>
		</div>
	);
}

// ───────────────────────── Header ─────────────────────────

function Header({ topic }: { topic: TopicPageData["topic"] }) {
	return (
		<header className="space-y-2">
			<div className="flex items-center gap-2 text-xs">
				<span className="rounded-full bg-bg-modifier px-2 py-0.5 font-medium text-text-muted">
					주제 #{topic.priority}
				</span>
				{topic.source === "AI" && (
					<span className="inline-flex items-center gap-0.5 rounded-full bg-[color:var(--interactive-accent)]/15 px-2 py-0.5 font-medium text-[color:var(--interactive-accent)]">
						<Sparkles className="h-3 w-3" />
						AI 제안
					</span>
				)}
			</div>
			<h1 className="text-2xl font-bold text-text-normal">📌 {topic.title}</h1>
			{topic.description && (
				<p className="text-sm text-text-muted">{topic.description}</p>
			)}
		</header>
	);
}

// ───────────────────────── Reason Card ─────────────────────────

function ReasonCard({ reason }: { reason: string }) {
	return (
		<Card className="border-[color:var(--interactive-accent)]/30 bg-[color:var(--interactive-accent)]/5">
			<CardContent className="flex gap-3 p-4">
				<Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--interactive-accent)]" />
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--interactive-accent)]">
						AI가 이 주제를 제안한 이유
					</p>
					<p className="mt-1 text-sm italic leading-relaxed text-text-muted">
						{reason}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

// ───────────────────────── Resources ─────────────────────────

function ResourcesSection({ resources }: { resources: MeetingResource[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>📎 수집 자료</CardTitle>
				<CardDescription>
					{resources.length > 0
						? `${resources.length}건 · AI가 자동 수집`
						: "아직 자료가 없습니다"}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{resources.length === 0 ? (
					<div className="py-6 text-center text-xs text-text-muted">
						주제가 확정되면 AI가 자동으로 자료를 수집합니다.
					</div>
				) : (
					<div className="space-y-2">
						{resources.map((r) => (
							<ResourceRow key={r.id} resource={r} />
						))}
					</div>
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

// ───────────────────────── Decisions ─────────────────────────

function DecisionsCard({ decisions }: { decisions: string[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>✅ 이 주제에 대한 결정사항</CardTitle>
				<CardDescription>
					AI가 회의록에서 추출한 결정
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="space-y-2">
					{decisions.map((d, i) => (
						<li key={i} className="flex gap-2 text-sm">
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-green)]" />
							<span className="text-text-normal">{d}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

// ───────────────────────── Minutes Excerpt ─────────────────────────

function MinutesExcerptCard({ excerpt }: { excerpt: string | null }) {
	if (!excerpt) {
		return (
			<Card className="border-dashed">
				<CardHeader>
					<CardTitle
						className={cn("flex items-center gap-2 text-text-faint")}
					>
						<MessageSquareQuote className="h-4 w-4" />
						회의록 발췌
					</CardTitle>
					<CardDescription>
						회의록이 작성되면 이 주제 관련 부분이 자동 발췌됩니다
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<MessageSquareQuote className="h-4 w-4 text-text-muted" />
					회의록 발췌 (이 주제 관련)
				</CardTitle>
			</CardHeader>
			<CardContent>
				<pre className="whitespace-pre-wrap rounded-md border-l-2 border-[color:var(--interactive-accent)] bg-bg-primary p-4 text-xs italic leading-relaxed text-text-muted">
					{excerpt}
				</pre>
			</CardContent>
		</Card>
	);
}
