/**
 * ChecklistSplitModal — PO-11 AI 업무 세분화.
 * AI가 Task를 체크리스트 5~7개로 쪼개 제안 → PM 편집 후 저장.
 */

import { useState } from "react";
import { App, Notice } from "obsidian";
import { Sparkles, X } from "lucide-react";
import {
	BaseReactModal,
	Button,
	FormField,
	inputClass,
	ModalLayout,
} from "shared/ui";

interface Item {
	id: string;
	text: string;
}

const mockItems: Item[] = [
	{ id: "1", text: "엔드포인트 정의 (POST /auth/login)" },
	{ id: "2", text: "JWT 토큰 발급 로직" },
	{ id: "3", text: "bcrypt 비밀번호 해시·검증" },
	{ id: "4", text: "세션 저장 (SQLite)" },
	{ id: "5", text: "테스트 케이스 작성" },
];

function Content({
	taskTitle,
	onClose,
}: {
	taskTitle: string;
	onClose: () => void;
}) {
	const [items, setItems] = useState(mockItems);
	const [newText, setNewText] = useState("");

	const update = (id: string, text: string) =>
		setItems(items.map((it) => (it.id === id ? { ...it, text } : it)));
	const remove = (id: string) => setItems(items.filter((it) => it.id !== id));
	const add = () => {
		if (!newText.trim()) return;
		setItems([...items, { id: String(Date.now()), text: newText.trim() }]);
		setNewText("");
	};

	return (
		<ModalLayout
			title="🤖 AI 업무 세분화"
			description={`Task "${taskTitle}" 를 체크리스트로 쪼갭니다`}
			submitLabel={`${items.length}개 항목 저장`}
			submitDisabled={items.length < 2}
			onSubmit={() => {
				new Notice(`[미구현] 체크리스트 ${items.length}개 저장 예정`);
				onClose();
			}}
			onCancel={onClose}
			widthClass="max-w-xl"
		>
			<div className="mb-4 flex items-center gap-2 text-xs text-text-muted">
				<Sparkles className="h-3.5 w-3.5 text-[color:var(--interactive-accent)]" />
				<span>AI가 초안 제안 · 편집·삭제·추가 자유</span>
			</div>

			<FormField label={`체크리스트 (${items.length}개)`}>
				<ul className="space-y-2">
					{items.map((it, i) => (
						<li key={it.id} className="flex items-center gap-2">
							<span className="w-5 shrink-0 text-[11px] font-bold text-text-faint">
								{i + 1}.
							</span>
							<input
								type="text"
								className={inputClass}
								value={it.text}
								onChange={(e) => update(it.id, e.target.value)}
							/>
							<button
								onClick={() => remove(it.id)}
								className="shrink-0 rounded p-1 text-text-faint hover:bg-[color:var(--color-red)]/10 hover:text-[color:var(--color-red)]"
								aria-label="삭제"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						</li>
					))}
				</ul>
			</FormField>

			<FormField label="항목 추가">
				<div className="flex gap-2">
					<input
						type="text"
						className={inputClass}
						placeholder="새 체크 항목..."
						value={newText}
						onChange={(e) => setNewText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								add();
							}
						}}
					/>
					<Button variant="secondary" onClick={add}>
						추가
					</Button>
				</div>
			</FormField>
		</ModalLayout>
	);
}

export class ChecklistSplitModal extends BaseReactModal {
	private readonly taskTitle: string;

	constructor(app: App, taskTitle: string) {
		super(app);
		this.taskTitle = taskTitle;
	}

	renderContent() {
		return <Content taskTitle={this.taskTitle} onClose={() => this.close()} />;
	}
}
