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
import type { PharosPluginLike } from "../../../app/settings";
import type { TaskChecklistItem } from "../domain/taskDetailData";

interface Item {
	id: string;
	text: string;
}

function Content({
	taskTitle,
	initialItems,
	onSave,
	onClose,
}: {
	taskTitle: string;
	// mockItems 대신 호출부(TaskDetailItemView)가 로드한 실제 체크리스트를 받음
	initialItems: Item[];
	// 저장 로직은 Modal 클래스에서 비동기로 처리 — Content는 UI만 담당
	onSave: (items: Item[]) => Promise<void>;
	onClose: () => void;
}) {
	const [items, setItems] = useState<Item[]>(initialItems);
	const [newText, setNewText] = useState("");

	const update = (id: string, text: string) =>
		setItems(items.map((it) => (it.id === id ? { ...it, text } : it)));
	const remove = (id: string) => setItems(items.filter((it) => it.id !== id));
	const add = () => {
		if (!newText.trim()) return;
		setItems([...items, { id: `chk-${Date.now()}`, text: newText.trim() }]);
		setNewText("");
	};

	return (
		<ModalLayout
			title="🤖 AI 업무 세분화"
			description={`Task "${taskTitle}" 를 체크리스트로 쪼갭니다`}
			submitLabel={`${items.length}개 항목 저장`}
			submitDisabled={items.length < 2}
			onSubmit={() => {
				// 저장 성공 후 Modal 닫기, 실패 시 Modal 유지 (오류 Notice는 handleSave에서)
				void onSave(items)
					.then(() => onClose())
					.catch((err: unknown) =>
						new Notice(`[오류] 체크리스트 저장 실패: ${String(err)}`),
					);
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
	private readonly plugin: PharosPluginLike;
	private readonly taskId: string;
	private readonly taskTitle: string;
	// TaskChecklistItem(뷰모델) → Item(편집용)으로 변환한 초기값
	// checked/checkedAt/checkedBy는 텍스트 편집 시 불필요하므로 제외
	private readonly initialItems: Item[];

	constructor(
		app: App,
		plugin: PharosPluginLike,
		taskId: string,
		taskTitle: string,
		// TaskDetailItemView가 이미 로드한 체크리스트를 그대로 받음
		// — Modal 내부에서 다시 fetch하지 않아도 됨
		initialChecklist: TaskChecklistItem[],
	) {
		super(app);
		this.plugin = plugin;
		this.taskId = taskId;
		this.taskTitle = taskTitle;
		this.initialItems = initialChecklist.map((c) => ({ id: c.id, text: c.text }));
	}

	private async handleSave(items: Item[]): Promise<void> {
		// 체크 상태 보존·신규 초기화는 taskService.saveChecklist() 내부에서 처리
		await this.plugin.taskService.saveChecklist(this.taskId, items);
		// saveSettings()로 pharos:state-changed 이벤트를 발행해 모든 ItemView 리렌더 트리거
		await this.plugin.saveSettings();
		new Notice(`체크리스트 ${items.length}개 저장 완료`);
	}

	renderContent() {
		return (
			<Content
				taskTitle={this.taskTitle}
				initialItems={this.initialItems}
				onSave={(items) => this.handleSave(items)}
				onClose={() => this.close()}
			/>
		);
	}
}
