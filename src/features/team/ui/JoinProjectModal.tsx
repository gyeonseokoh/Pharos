/**
 * JoinProjectModal — PM-1 초기 가입 + 기술스택 + when2meet.
 * 팀원이 초대 링크/코드로 들어와서 채우는 폼.
 *
 * 호출 경로:
 *   - 초대 링크 클릭 → main.ts protocol handler → 이 모달 (token 검증된 상태)
 *   - 또는 PO가 직접 띄움 (token 없이 — 시연·테스트)
 */

import { useState } from "react";
import { App, Notice } from "obsidian";
import {
	BaseReactModal,
	FormField,
	inputClass,
	ModalLayout,
} from "shared/ui";
import { When2MeetGrid } from "./When2MeetGrid";
import type { MemberRole, MemberPermission } from "../domain/teamSchema";
import type { PharosPluginLike } from "../../../app/settings";

export interface JoinProjectModalArgs {
	/** 초대 토큰 (있으면 검증된 상태로 들어옴). 없으면 시연·테스트 모드. */
	token?: string;
	/** 토큰 검증에서 받은 권한 (기본 WRITE). */
	permission?: MemberPermission;
}

interface FormState {
	name: string;
	role: MemberRole;
	techStacks: string;
	availability: Set<string>;
}

function Content({
	plugin,
	args,
	onClose,
}: {
	plugin: PharosPluginLike;
	args: JoinProjectModalArgs;
	onClose: () => void;
}) {
	const [form, setForm] = useState<FormState>({
		name: "",
		role: "PM",
		techStacks: "",
		availability: new Set<string>(),
	});

	const canSubmit =
		form.name.trim() &&
		form.techStacks.trim() &&
		form.availability.size > 0;

	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (): Promise<void> => {
		if (submitting) return;
		setSubmitting(true);
		try {
			const techStacks = form.techStacks
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			await plugin.teamService.addMember({
				name: form.name.trim(),
				role: form.role,
				permission: args.permission ?? "WRITE",
				techStacks,
			});
			// 가입 완료 → 토큰 소비 (일회용)
			if (args.token) {
				await plugin.inviteService.consumeToken(args.token).catch(() => {});
			}
			// TODO(PM-1): availability를 AvailabilityService로 저장
			new Notice(`${form.name} 님 가입 완료`);
			onClose();
		} catch (err) {
			new Notice(`가입 실패: ${(err as Error).message}`);
			setSubmitting(false);
		}
	};

	return (
		<ModalLayout
			title="🙋 프로젝트 참여"
			description={
				args.token
					? "초대 링크로 진입했습니다. 정보를 입력해주세요"
					: "정보를 입력하고 가용 시간을 선택해주세요"
			}
			submitLabel={submitting ? "처리 중..." : "참여"}
			submitDisabled={!canSubmit || submitting}
			onSubmit={() => void handleSubmit()}
			onCancel={onClose}
			widthClass="max-w-2xl"
		>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				<FormField label="이름" required>
					<input
						type="text"
						className={inputClass}
						value={form.name}
						onChange={(e) => setForm({ ...form, name: e.target.value })}
					/>
				</FormField>
				<FormField label="역할" required>
					<select
						className={inputClass}
						style={{ height: "38px", lineHeight: "1.5" }}
						value={form.role}
						onChange={(e) =>
							setForm({ ...form, role: e.target.value as MemberRole })
						}
					>
						<option value="PM">PM (팀원)</option>
						<option value="PO">PO (팀장)</option>
					</select>
				</FormField>
			</div>

			<FormField
				label="기술 스택"
				required
				hint="쉼표로 구분 (예: React, TypeScript, Python)"
			>
				<input
					type="text"
					className={inputClass}
					placeholder="React, TypeScript, Node.js"
					value={form.techStacks}
					onChange={(e) => setForm({ ...form, techStacks: e.target.value })}
				/>
			</FormField>

			<FormField
				label="고정 가용 시간"
				required
				hint="주간 반복. AI가 팀원들의 교집합에서 고정 회의시간을 제안합니다."
			>
				<When2MeetGrid
					selected={form.availability}
					onChange={(s) => setForm({ ...form, availability: s })}
					days={[0, 1, 2, 3, 4, 5, 6]}
				/>
			</FormField>
		</ModalLayout>
	);
}

export class JoinProjectModal extends BaseReactModal {
	constructor(
		app: App,
		private readonly plugin: PharosPluginLike,
		private readonly args: JoinProjectModalArgs = {},
	) {
		super(app);
	}

	renderContent() {
		return (
			<Content
				plugin={this.plugin}
				args={this.args}
				onClose={() => this.close()}
			/>
		);
	}
}
