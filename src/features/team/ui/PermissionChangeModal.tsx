/**
 * PermissionChangeModal — PO-9 팀원 권한 변경.
 * 팀원 카드의 "권한 변경" 버튼 → 현재 권한 표시 → ADMIN/WRITE/READ 선택 → 저장.
 */

import { useState } from "react";
import { App, Notice } from "obsidian";
import {
	BaseReactModal,
	FormField,
	ModalLayout,
} from "shared/ui";
import { cn } from "shared/ui/utils";
import type { PharosPluginLike } from "../../../app/settings";
import type { MemberPermission } from "../domain/teamSchema";

const PERMISSION_OPTIONS: { value: MemberPermission; label: string; desc: string }[] = [
	{ value: "ADMIN", label: "ADMIN", desc: "프로젝트 설정·팀원 관리 가능" },
	{ value: "WRITE", label: "WRITE", desc: "Task·회의록 작성 가능" },
	{ value: "READ",  label: "READ",  desc: "조회만 가능" },
];

function Content({
	memberId,
	memberName,
	currentPermission,
	onSave,
	onClose,
}: {
	memberId: string;
	memberName: string;
	currentPermission: MemberPermission;
	// 저장 로직은 Modal 클래스에서 비동기 처리 — Content는 UI만 담당
	onSave: (permission: MemberPermission) => Promise<void>;
	onClose: () => void;
}) {
	const [selected, setSelected] = useState<MemberPermission>(currentPermission);

	return (
		<ModalLayout
			title="🔑 권한 변경"
			description={`${memberName}의 권한을 변경합니다`}
			submitLabel="저장"
			// 현재 권한과 동일하면 저장 불필요
			submitDisabled={selected === currentPermission}
			onSubmit={() => {
				void onSave(selected)
					.then(() => onClose())
					.catch((err: unknown) =>
						new Notice(`[오류] 권한 변경 실패: ${String(err)}`),
					);
			}}
			onCancel={onClose}
		>
			<FormField label="권한 선택">
				<div className="space-y-2">
					{PERMISSION_OPTIONS.map((opt) => (
						<div
							key={opt.value}
							onClick={() => setSelected(opt.value)}
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									setSelected(opt.value);
								}
							}}
							className={cn(
								"flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors",
								selected === opt.value
									? "border-[color:var(--interactive-accent)] bg-[color:var(--interactive-accent)]/10"
									: "border-bg-modifier bg-bg-secondary hover:bg-[color:var(--background-modifier-hover)]",
							)}
						>
							<div
								className={cn(
									"flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
									selected === opt.value
										? "border-[color:var(--interactive-accent)]"
										: "border-text-muted",
								)}
							>
								{selected === opt.value && (
									<div className="h-2 w-2 rounded-full bg-[color:var(--interactive-accent)]" />
								)}
							</div>
							<div>
								<p className="text-sm font-medium text-text-normal">
									{opt.label}
								</p>
								<p className="text-xs text-text-muted">{opt.desc}</p>
							</div>
						</div>
					))}
				</div>
			</FormField>
		</ModalLayout>
	);
}

export class PermissionChangeModal extends BaseReactModal {
	private readonly plugin: PharosPluginLike;
	private readonly memberId: string;
	private readonly memberName: string;
	private readonly currentPermission: MemberPermission;

	constructor(
		app: App,
		plugin: PharosPluginLike,
		memberId: string,
		memberName: string,
		currentPermission: MemberPermission,
	) {
		super(app);
		this.plugin = plugin;
		this.memberId = memberId;
		this.memberName = memberName;
		this.currentPermission = currentPermission;
	}

	private async handleSave(permission: MemberPermission): Promise<void> {
		await this.plugin.teamService.updatePermission(this.memberId, permission);
		// saveSettings()로 pharos:state-changed 발행 → TeamList 리렌더 트리거
		await this.plugin.saveSettings();
		new Notice(`${this.memberName}의 권한이 ${permission}으로 변경되었습니다`);
	}

	renderContent() {
		return (
			<Content
				memberId={this.memberId}
				memberName={this.memberName}
				currentPermission={this.currentPermission}
				onSave={(permission) => this.handleSave(permission)}
				onClose={() => this.close()}
			/>
		);
	}
}
