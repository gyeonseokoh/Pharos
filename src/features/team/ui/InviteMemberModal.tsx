/**
 * InviteMemberModal — PO-9 팀원 초대 (일회용 링크 발급).
 *
 * 동작:
 *   1. PO가 권한 프리셋 선택 + (선택) 이메일 입력
 *   2. "링크 생성" 클릭 → InviteService.issueToken() 호출
 *      - 시연용 LocalInviteService: Vault에 Invite 저장, UUID 토큰
 *      - 백엔드 ServerInviteService: 서버 호출 (경석 영역, 합류 시 자동)
 *   3. obsidian://pharos-join?token=... 링크 표시 + 복사 버튼
 *   4. 팀원이 그 링크 클릭 → main.ts protocol handler → JoinProjectModal
 */

import { useEffect, useState } from "react";
import { App, Notice } from "obsidian";
import { Copy, RefreshCw } from "lucide-react";
import {
	BaseReactModal,
	Button,
	FormField,
	inputClass,
	ModalLayout,
} from "shared/ui";
import { cn } from "shared/ui/utils";
import type { MemberPermission } from "../domain/teamSchema";
import type { PharosPluginLike } from "../../../app/settings";
import type { IssuedInvite } from "../services/inviteService";

function Content({
	plugin,
	onClose,
}: {
	plugin: PharosPluginLike;
	onClose: () => void;
}) {
	const [email, setEmail] = useState("");
	const [permission, setPermission] = useState<MemberPermission>("WRITE");
	const [issued, setIssued] = useState<IssuedInvite | null>(null);
	const [issuing, setIssuing] = useState(false);

	// 모달 열 때 자동으로 첫 토큰 발급
	useEffect(() => {
		void issue();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const issue = async (): Promise<void> => {
		setIssuing(true);
		try {
			const result = await plugin.inviteService.issueToken({
				permission,
				email: email || undefined,
			});
			setIssued(result);
		} catch (err) {
			new Notice(`토큰 발급 실패: ${(err as Error).message}`);
		} finally {
			setIssuing(false);
		}
	};

	const copy = (text: string, label: string) => {
		void navigator.clipboard.writeText(text).then(() => {
			new Notice(`${label} 복사됨`);
		});
	};

	const handleEmailInvite = (): void => {
		if (!email || !issued) return;
		// 시연용: 메일 발송은 백엔드 영역. 현재는 안내만.
		new Notice(
			`현재 시연 모드: 링크 복사 후 직접 전달하세요. (백엔드 합류 시 자동 발송)`,
		);
		onClose();
	};

	return (
		<ModalLayout
			title="👥 팀원 초대"
			description="일회용 초대 링크 (24시간 유효)"
			submitLabel={email ? "이메일로 발송" : undefined}
			onSubmit={email ? handleEmailInvite : undefined}
			onCancel={onClose}
		>
			<FormField label="권한 프리셋" required>
				<div className="flex gap-2">
					{(["READ", "WRITE", "ADMIN"] as const).map((p) => (
						<div
							key={p}
							onClick={() => {
								setPermission(p);
								void issue();
							}}
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									setPermission(p);
									void issue();
								}
							}}
							className={cn(
								"flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-medium transition-colors",
								permission === p
									? "border-[color:var(--interactive-accent)] bg-[color:var(--interactive-accent)]/10 text-[color:var(--interactive-accent)]"
									: "border-bg-modifier bg-bg-secondary text-text-muted hover:text-text-normal",
							)}
						>
							{p === "READ" ? "읽기" : p === "WRITE" ? "편집" : "관리자"}
						</div>
					))}
				</div>
			</FormField>

			<FormField
				label="일회용 초대 링크"
				hint={
					issued
						? `권한 "${issued.permission}" · 만료 ${formatExpiry(issued.expiresAt)}`
						: "발급 중..."
				}
			>
				<div className="flex gap-2">
					<input
						readOnly
						className={cn(inputClass, "font-mono text-[11px]")}
						value={issued?.inviteUrl ?? "(발급 중)"}
					/>
					<Button
						variant="secondary"
						onClick={() => issued && copy(issued.inviteUrl, "링크")}
						disabled={!issued}
					>
						<Copy className="h-3.5 w-3.5" />
					</Button>
					<Button
						variant="ghost"
						onClick={() => void issue()}
						disabled={issuing}
						title="새 토큰 발급"
					>
						<RefreshCw className={cn("h-3.5 w-3.5", issuing && "animate-spin")} />
					</Button>
				</div>
			</FormField>

			<FormField
				label="이메일로 직접 발송 (선택)"
				hint="백엔드 합류 시 자동 발송 — 지금은 링크 복사 후 직접 전달"
			>
				<input
					type="email"
					className={inputClass}
					placeholder="member@example.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
			</FormField>
		</ModalLayout>
	);
}

function formatExpiry(iso: string): string {
	const ms = Date.parse(iso) - Date.now();
	if (ms < 0) return "만료됨";
	const hours = Math.floor(ms / (60 * 60 * 1000));
	const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
	return hours > 0 ? `${hours}시간 ${mins}분 후` : `${mins}분 후`;
}

export class InviteMemberModal extends BaseReactModal {
	constructor(
		app: App,
		private readonly plugin: PharosPluginLike,
	) {
		super(app);
	}

	renderContent() {
		return <Content plugin={this.plugin} onClose={() => this.close()} />;
	}
}
