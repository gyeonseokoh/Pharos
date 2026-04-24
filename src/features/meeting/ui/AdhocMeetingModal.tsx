/**
 * AdhocMeetingModal — PO-4 임시 회의 생성.
 * PM-2 주간 가용시간 기반으로 AI가 후보 3개 제시 → PO 선택 + 주제 입력.
 */

import { useState } from "react";
import { App, Notice } from "obsidian";
import { Sparkles } from "lucide-react";
import {
	BaseReactModal,
	FormField,
	inputClass,
	ModalLayout,
	textareaClass,
} from "shared/ui";
import { cn } from "shared/ui/utils";

interface TimeCandidate {
	id: string;
	date: string;
	time: string;
	attendees: number;
	total: number;
}

const mockCandidates: TimeCandidate[] = [
	{
		id: "c1",
		date: "2026-04-25",
		time: "15:00",
		attendees: 5,
		total: 5,
	},
	{
		id: "c2",
		date: "2026-04-26",
		time: "19:00",
		attendees: 4,
		total: 5,
	},
	{
		id: "c3",
		date: "2026-04-27",
		time: "10:00",
		attendees: 4,
		total: 5,
	},
];

function Content({
	initialDate,
	onClose,
}: {
	initialDate?: string;
	onClose: () => void;
}) {
	const [selectedCandidate, setSelectedCandidate] = useState<string | null>(
		null,
	);
	const [customDate, setCustomDate] = useState(initialDate ?? "");
	const [customTime, setCustomTime] = useState("");
	const [topic, setTopic] = useState("");
	const [description, setDescription] = useState("");

	const useCustom = customDate !== "" || customTime !== "";
	const canSubmit =
		topic.trim().length >= 5 &&
		(selectedCandidate || (customDate && customTime));

	return (
		<ModalLayout
			title="➕ 임시 회의 추가"
			description="AI가 팀원 가용시간 기반으로 후보 3개를 제안합니다"
			submitLabel="회의 생성"
			submitDisabled={!canSubmit}
			onSubmit={() => {
				new Notice(`[미구현] 임시 회의 "${topic}" 생성 예정`);
				onClose();
			}}
			onCancel={onClose}
			widthClass="max-w-xl"
		>
			<FormField
				label="✨ AI 추천 시간대"
				hint="PM-2 주간 가용시간 기반 · 참석 가능 인원수 순"
			>
				<div className="space-y-2">
					{mockCandidates.map((c) => {
						const selected = selectedCandidate === c.id && !useCustom;
						const onPick = () => {
							setSelectedCandidate(c.id);
							setCustomDate("");
							setCustomTime("");
						};
						return (
							<div
								key={c.id}
								onClick={onPick}
								role="button"
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onPick();
									}
								}}
								className={cn(
									"flex w-full cursor-pointer items-center justify-between rounded-md border p-3 text-left transition-colors",
									selected
										? "border-[color:var(--interactive-accent)] bg-[color:var(--interactive-accent)]/10"
										: "border-bg-modifier bg-bg-secondary hover:bg-[color:var(--background-modifier-hover)]",
								)}
							>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium text-text-normal">
										{c.date} · {c.time}
									</p>
									<p className="mt-0.5 text-[11px] text-text-faint">
										참석 가능 {c.attendees}/{c.total}명
									</p>
								</div>
								<Sparkles
									className={cn(
										"h-4 w-4 shrink-0",
										c.attendees === c.total
											? "text-[color:var(--color-green)]"
											: "text-[color:var(--color-orange)]",
									)}
								/>
							</div>
						);
					})}
				</div>
			</FormField>

			<FormField
				label="직접 지정"
				hint="위 후보 외 시간으로 설정할 때"
			>
				<div className="flex gap-2">
					<input
						type="date"
						className={inputClass}
						value={customDate}
						onChange={(e) => {
							setCustomDate(e.target.value);
							setSelectedCandidate(null);
						}}
					/>
					<input
						type="time"
						className={inputClass}
						value={customTime}
						onChange={(e) => {
							setCustomTime(e.target.value);
							setSelectedCandidate(null);
						}}
					/>
				</div>
			</FormField>

			<FormField label="회의 주제" required hint="5자 이상">
				<input
					type="text"
					className={inputClass}
					placeholder="예: UI/UX 리뷰"
					value={topic}
					onChange={(e) => setTopic(e.target.value)}
				/>
			</FormField>

			<FormField label="설명">
				<textarea
					className={textareaClass}
					rows={2}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</FormField>
		</ModalLayout>
	);
}

export class AdhocMeetingModal extends BaseReactModal {
	private readonly initialDate?: string;

	constructor(app: App, initialDate?: string) {
		super(app);
		this.initialDate = initialDate;
	}

	renderContent() {
		return (
			<Content initialDate={this.initialDate} onClose={() => this.close()} />
		);
	}
}
