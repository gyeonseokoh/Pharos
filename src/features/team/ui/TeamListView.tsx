/**
 * TeamListView — 팀원 목록 뷰 (PO-9).
 */

import { useMemo } from "react";
import {
	AlertTriangle,
	Clock,
	Mail,
	Shield,
	UserPlus,
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
	MemberPermission,
	MemberRole,
	PendingInvite,
	TeamListData,
	TeamMember,
} from "../domain/teamListData";

export interface TeamListViewProps {
	data: TeamListData;
	/** "팀원 초대" 버튼 → Invite Modal 오픈. */
	onInvite?: () => void;
	/** 팀원 카드 "권한 변경" 버튼. */
	onChangePermission?: (memberId: string) => void;
	/** 팀원 카드 "이탈 처리" 버튼 (PO-14, MVP 외). */
	onDeactivate?: (memberId: string) => void;
	onBackToHome?: () => void;
}

export function TeamListView({
	data,
	onInvite,
	onChangePermission,
	onDeactivate,
	onBackToHome,
}: TeamListViewProps) {
	const activeMembers = useMemo(
		() => data.members.filter((m) => m.isActive),
		[data.members],
	);
	const inactiveMembers = useMemo(
		() => data.members.filter((m) => !m.isActive),
		[data.members],
	);

	const navItems: BackNavItem[] = [];
	if (onBackToHome)
		navItems.push({ icon: "home", label: "홈으로", onClick: onBackToHome });

	return (
		<div className="pharos-root min-h-full w-full overflow-y-auto bg-bg-primary p-6">
			<div className="mx-auto max-w-4xl space-y-6">
				{navItems.length > 0 && <BackNav items={navItems} />}
				<Header activeCount={activeMembers.length} onInvite={onInvite} />

				<StatSummary data={data} />

				<section>
					<h2 className="mb-2 text-sm font-semibold text-text-muted">
						팀원 ({activeMembers.length})
					</h2>
					<div className="space-y-2">
						{activeMembers.map((m) => (
							<MemberCard
								key={m.id}
								member={m}
								isMe={m.id === data.currentUserId}
								onChangePermission={onChangePermission}
								onDeactivate={onDeactivate}
							/>
						))}
					</div>
				</section>

				{data.pendingInvites.length > 0 && (
					<section>
						<h2 className="mb-2 text-sm font-semibold text-text-muted">
							대기 중인 초대 ({data.pendingInvites.length})
						</h2>
						<div className="space-y-2">
							{data.pendingInvites.map((inv) => (
								<PendingInviteCard key={inv.id} invite={inv} />
							))}
						</div>
					</section>
				)}

				{inactiveMembers.length > 0 && (
					<section>
						<h2 className="mb-2 text-sm font-semibold text-text-faint">
							비활성 ({inactiveMembers.length})
						</h2>
						<div className="space-y-2">
							{inactiveMembers.map((m) => (
								<MemberCard
									key={m.id}
									member={m}
									isMe={m.id === data.currentUserId}
								/>
							))}
						</div>
					</section>
				)}
			</div>
		</div>
	);
}

// ───────────────────────── Header ─────────────────────────

function Header({
	activeCount,
	onInvite,
}: {
	activeCount: number;
	onInvite?: () => void;
}) {
	return (
		<header className="flex items-start justify-between">
			<div>
				<p className="text-xs uppercase tracking-wide text-text-faint">
					Pharos Team
				</p>
				<h1 className="mt-1 text-2xl font-bold text-text-normal">
					👥 팀원 목록
				</h1>
				<p className="mt-1 text-xs text-text-muted">활성 팀원 {activeCount}명</p>
			</div>
			{onInvite && (
				<Button onClick={onInvite}>
					<UserPlus className="mr-1 h-4 w-4" />
					팀원 초대
				</Button>
			)}
		</header>
	);
}

// ───────────────────────── Stat Summary ─────────────────────────

function StatSummary({ data }: { data: TeamListData }) {
	const active = data.members.filter((m) => m.isActive);
	const missingAvailability = active.filter((m) => !m.hasFilledAvailability);

	if (missingAvailability.length === 0) return null;

	return (
		<Card className="border-[color:var(--color-orange)]/30 bg-[color:var(--color-orange)]/5">
			<CardContent className="flex items-start gap-3 p-4">
				<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-orange)]" />
				<div>
					<p className="text-xs font-semibold text-[color:var(--color-orange)]">
						초기 가용시간 미입력 {missingAvailability.length}명
					</p>
					<p className="mt-0.5 text-[11px] text-text-muted">
						{missingAvailability.map((m) => m.name).join(", ")} 님의 when2meet
						입력이 필요합니다. 고정 회의시간 확정이 지연됩니다.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

// ───────────────────────── Member Card ─────────────────────────

function MemberCard({
	member,
	isMe,
	onChangePermission,
	onDeactivate,
}: {
	member: TeamMember;
	isMe: boolean;
	onChangePermission?: (id: string) => void;
	onDeactivate?: (id: string) => void;
}) {
	const color = hashColor(member.id);

	return (
		<Card className={cn(!member.isActive && "opacity-60")}>
			<CardContent className="flex items-center gap-4 p-4">
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
					style={{ backgroundColor: color }}
				>
					{member.name[0]}
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-sm font-semibold text-text-normal">
							{member.name}
							{isMe && (
								<span className="ml-1.5 text-[10px] font-medium text-[color:var(--interactive-accent)]">
									(나)
								</span>
							)}
						</p>
						<RoleBadge role={member.role} />
						<PermissionBadge permission={member.permission} />
						{!member.hasFilledAvailability && member.isActive && (
							<span className="inline-flex items-center gap-0.5 rounded-full bg-[color:var(--color-orange)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--color-orange)]">
								<Clock className="h-2.5 w-2.5" />
								가용시간 미입력
							</span>
						)}
					</div>

					<p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-faint">
						<Mail className="h-3 w-3" />
						{member.email}
					</p>

					{member.techStacks.length > 0 && (
						<div className="mt-1.5 flex flex-wrap gap-1">
							{member.techStacks.map((t) => (
								<span
									key={t}
									className="rounded bg-bg-modifier px-1.5 py-0.5 text-[10px] text-text-muted"
								>
									{t}
								</span>
							))}
						</div>
					)}
				</div>

				{member.isActive && !isMe && (onChangePermission || onDeactivate) && (
					<div className="flex shrink-0 gap-1">
						{onChangePermission && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onChangePermission(member.id)}
							>
								권한
							</Button>
						)}
						{onDeactivate && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onDeactivate(member.id)}
							>
								이탈
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function RoleBadge({ role }: { role: MemberRole }) {
	const config =
		role === "PO"
			? { label: "PO", class: "bg-[color:var(--interactive-accent)]/15 text-[color:var(--interactive-accent)]" }
			: { label: "PM", class: "bg-bg-modifier text-text-muted" };
	return (
		<span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", config.class)}>
			{config.label}
		</span>
	);
}

function PermissionBadge({ permission }: { permission: MemberPermission }) {
	const label = {
		ADMIN: "관리자",
		WRITE: "편집",
		READ: "읽기",
	}[permission];
	return (
		<span className="inline-flex items-center gap-0.5 rounded-full bg-bg-modifier px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
			<Shield className="h-2.5 w-2.5" />
			{label}
		</span>
	);
}

// ───────────────────────── Pending Invite ─────────────────────────

function PendingInviteCard({ invite }: { invite: PendingInvite }) {
	const expiresIn = useMemo(
		() => formatExpiresIn(invite.expiresAt),
		[invite.expiresAt],
	);
	return (
		<Card className="border-dashed">
			<CardContent className="flex items-center gap-4 p-4">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-modifier">
					<Mail className="h-5 w-5 text-text-faint" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-text-normal">
						{invite.email ?? "(이메일 미지정)"}
					</p>
					<p className="mt-0.5 text-[11px] text-text-faint">
						{invite.permission === "ADMIN" ? "관리자" : invite.permission === "WRITE" ? "편집" : "읽기"} 권한 ·{" "}
						{expiresIn}
					</p>
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

function formatExpiresIn(iso: string): string {
	const diff = new Date(iso).getTime() - Date.now();
	if (diff <= 0) return "만료됨";
	const hours = Math.floor(diff / (1000 * 60 * 60));
	if (hours < 1) return "곧 만료";
	return `${hours}시간 후 만료`;
}
