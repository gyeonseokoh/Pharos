/**
 * NewProjectModal — PO-0 프로젝트 생성.
 */

import { useState } from "react";
import { App, Notice } from "obsidian";
import {
	BaseReactModal,
	FormField,
	inputClass,
	ModalLayout,
	textareaClass,
} from "shared/ui";
import { cn } from "shared/ui/utils";

interface FormState {
	topic: string;
	description: string;
	deadline: string;
	fixedMeetingToggle: boolean;
	fixedMeetingDay: number; // 0-6
	fixedMeetingTime: string; // HH:MM
}

export interface NewProjectModalProps {
	onClose: () => void;
	onSubmit?: (data: FormState) => void;
}

function NewProjectModalContent({ onClose, onSubmit }: NewProjectModalProps) {
	const [form, setForm] = useState<FormState>({
		topic: "",
		description: "",
		deadline: "",
		fixedMeetingToggle: true,
		fixedMeetingDay: 1,
		fixedMeetingTime: "14:00",
	});

	const canSubmit = form.topic.trim().length >= 5 && form.deadline !== "";

	const handleSubmit = () => {
		onSubmit?.(form);
		new Notice(`[미구현] 프로젝트 "${form.topic}" 생성 예정`);
		onClose();
	};

	return (
		<ModalLayout
			title="🆕 새 프로젝트"
			description="프로젝트 보고서를 입력하세요. 팀원 정보는 초대 시 각자 입력합니다."
			submitLabel="프로젝트 생성"
			submitDisabled={!canSubmit}
			onSubmit={handleSubmit}
			onCancel={onClose}
		>
			<FormField label="프로젝트 주제" required hint="5자 이상">
				<input
					type="text"
					className={inputClass}
					placeholder="예: AI 기반 프로젝트 관리 도구"
					value={form.topic}
					onChange={(e) => setForm({ ...form, topic: e.target.value })}
				/>
			</FormField>

			<FormField label="설명">
				<textarea
					className={textareaClass}
					rows={3}
					placeholder="프로젝트 목적·기능 개요·컨셉 등"
					value={form.description}
					onChange={(e) => setForm({ ...form, description: e.target.value })}
				/>
			</FormField>

			<FormField label="마감기한" required>
				<input
					type="date"
					className={inputClass}
					value={form.deadline}
					onChange={(e) => setForm({ ...form, deadline: e.target.value })}
				/>
			</FormField>

			<FormField
				label="고정 회의 시간"
				hint={
					form.fixedMeetingToggle
						? "팀원 각자 when2meet으로 가용시간 입력 후 AI가 교집합 제안"
						: "PO가 직접 요일·시간 지정 (팀원 가용시간 입력 스킵)"
				}
			>
				<div className="mb-2 flex gap-2">
					<ToggleButton
						active={form.fixedMeetingToggle}
						onClick={() => setForm({ ...form, fixedMeetingToggle: true })}
						label="🤖 AI가 교집합으로 정함 (권장)"
					/>
					<ToggleButton
						active={!form.fixedMeetingToggle}
						onClick={() => setForm({ ...form, fixedMeetingToggle: false })}
						label="✋ 직접 지정"
					/>
				</div>

				{!form.fixedMeetingToggle && (
					<div className="flex gap-2">
						<select
							className={inputClass}
							value={form.fixedMeetingDay}
							onChange={(e) =>
								setForm({ ...form, fixedMeetingDay: Number(e.target.value) })
							}
						>
							{["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
								<option key={i} value={i}>
									{d}요일
								</option>
							))}
						</select>
						<input
							type="time"
							className={inputClass}
							value={form.fixedMeetingTime}
							onChange={(e) =>
								setForm({ ...form, fixedMeetingTime: e.target.value })
							}
						/>
					</div>
				)}
			</FormField>
		</ModalLayout>
	);
}

function ToggleButton({
	active,
	onClick,
	label,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
}) {
	return (
		<div
			onClick={onClick}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick();
				}
			}}
			className={cn(
				"flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-medium transition-colors",
				active
					? "border-[color:var(--interactive-accent)] bg-[color:var(--interactive-accent)]/10 text-[color:var(--interactive-accent)]"
					: "border-bg-modifier bg-bg-secondary text-text-muted hover:text-text-normal",
			)}
		>
			{label}
		</div>
	);
}

export class NewProjectModal extends BaseReactModal {
	private readonly onSubmitCb?: (data: FormState) => void;

	constructor(app: App, onSubmit?: (data: FormState) => void) {
		super(app);
		this.onSubmitCb = onSubmit;
	}

	renderContent() {
		return (
			<NewProjectModalContent
				onClose={() => this.close()}
				onSubmit={this.onSubmitCb}
			/>
		);
	}
}
