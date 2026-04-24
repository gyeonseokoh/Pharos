/**
 * InviteMemberModal — PO-9 팀원 초대 (프로젝트 코드 + 일회용 링크 발급).
 */

import { useMemo, useState } from "react";
import { App, Notice } from "obsidian";
import { Copy } from "lucide-react";
import {
	BaseReactModal,
	Button,
	FormField,
	inputClass,
	ModalLayout,
} from "shared/ui";
import { cn } from "shared/ui/utils";
import type { MemberPermission } from "../domain/teamListData";

function randomCode() {
	const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
	let s = "";
	for (let i = 0; i < 4; i++)
		s += chars[Math.floor(Math.random() * chars.length)];
	return `PHAROS-${s}`;
}

function Content({ onClose }: { onClose: () => void }) {
	const [email, setEmail] = useState("");
	const [permission, setPermission] = useState<MemberPermission>("WRITE");

	// 프로젝트 코드: 세션당 고정 (목업)
	const projectCode = useMemo(() => randomCode(), []);
	const inviteLink = `obsidian://pharos/join?token=${Math.random().toString(36).slice(2, 18)}`;

	const copy = (text: string, label: string) => {
		navigator.clipboard.writeText(text).then(() => {
			new Notice(`${label} 복사됨`);
		});
	};

	return (
		<ModalLayout
			title="👥 팀원 초대"
			description="프로젝트 코드 또는 일회용 링크로 초대하세요"
			submitLabel={email ? "이메일로 초대" : undefined}
			onSubmit={
				email
					? () => {
							new Notice(`[미구현] ${email} 로 초대 이메일 발송 예정`);
							onClose();
						}
					: undefined
			}
			onCancel={onClose}
		>
			<FormField label="권한 프리셋" required>
				<div className="flex gap-2">
					{(["READ", "WRITE", "ADMIN"] as const).map((p) => (
						<div
							key={p}
							onClick={() => setPermission(p)}
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									setPermission(p);
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

			<FormField label="프로젝트 코드 (팀 전체 공유)" hint="권한은 가입 후 PO가 개별 부여">
				<div className="flex gap-2">
					<input
						readOnly
						className={cn(inputClass, "font-mono")}
						value={projectCode}
					/>
					<Button variant="secondary" onClick={() => copy(projectCode, "코드")}>
						<Copy className="h-3.5 w-3.5" />
					</Button>
				</div>
			</FormField>

			<FormField
				label="일회용 초대 링크"
				hint={`권한 "${permission}" 프리셋 · 24시간 유효`}
			>
				<div className="flex gap-2">
					<input
						readOnly
						className={cn(inputClass, "font-mono text-[11px]")}
						value={inviteLink}
					/>
					<Button variant="secondary" onClick={() => copy(inviteLink, "링크")}>
						<Copy className="h-3.5 w-3.5" />
					</Button>
				</div>
			</FormField>

			<FormField
				label="이메일로 직접 발송 (선택)"
				hint="위 링크를 이 주소로 자동 발송"
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

export class InviteMemberModal extends BaseReactModal {
	renderContent() {
		return <Content onClose={() => this.close()} />;
	}
}
