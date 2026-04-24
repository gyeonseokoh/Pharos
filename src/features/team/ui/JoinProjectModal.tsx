/**
 * JoinProjectModal — PM-1 초기 가입 + 기술스택 + when2meet.
 * 팀원이 초대 링크/코드로 들어와서 채우는 폼.
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

interface FormState {
	name: string;
	email: string;
	password: string;
	techStacks: string;
	availability: Set<string>;
}

function Content({ onClose }: { onClose: () => void }) {
	const [form, setForm] = useState<FormState>({
		name: "",
		email: "",
		password: "",
		techStacks: "",
		availability: new Set<string>(),
	});

	const canSubmit =
		form.name.trim() &&
		form.email.includes("@") &&
		form.password.length >= 6 &&
		form.techStacks.trim() &&
		form.availability.size > 0;

	return (
		<ModalLayout
			title="🙋 프로젝트 참여"
			description="정보를 입력하고 가용 시간을 선택해주세요"
			submitLabel="참여"
			submitDisabled={!canSubmit}
			onSubmit={() => {
				new Notice(`[미구현] ${form.name} 님 가입 예정`);
				onClose();
			}}
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
				<FormField label="이메일" required>
					<input
						type="email"
						className={inputClass}
						value={form.email}
						onChange={(e) => setForm({ ...form, email: e.target.value })}
					/>
				</FormField>
			</div>

			<FormField label="비밀번호" required hint="6자 이상">
				<input
					type="password"
					className={inputClass}
					value={form.password}
					onChange={(e) => setForm({ ...form, password: e.target.value })}
				/>
			</FormField>

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
	renderContent() {
		return <Content onClose={() => this.close()} />;
	}
}
