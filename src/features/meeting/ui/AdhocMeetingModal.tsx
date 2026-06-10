/**
 * AdhocMeetingModal — PO-4 임시 회의 생성.
 *
 * 흐름:
 *   1. PO 가 모달 열기 → "AI 추천 받기" 클릭
 *   2. plugin.agentService.coordinateSchedule(input) 호출
 *      → LLM 이 팀원 가용시간·기존 회의 분석해 후보 최대 3개 추천
 *   3. PO 가 추천 중 하나 선택 또는 직접 지정
 *   4. 주제·설명 입력 후 "회의 생성"
 *   5. plugin.meetingsService.create(...) 로 Vault 에 저장
 *
 * demoMode=true 시연 안정성:
 *   - AI/Provider 미연동·키 없음 상황에도 mock 후보 3개로 흐름 시연 가능
 *   - "회의 생성" 시에도 mock 후보 선택 → meetingsService.create() 호출은 그대로
 *     (Vault 저장은 정상, AI 만 우회)
 */

import { useMemo, useState } from "react";
import { App, Notice } from "obsidian";
import { Sparkles, Loader2 } from "lucide-react";
import {
	BaseReactModal,
	Button,
	FormField,
	inputClass,
	ModalLayout,
	textareaClass,
} from "shared/ui";
import { cn } from "shared/ui/utils";
import type { PharosPluginLike } from "../../../app/settings";
import type { MeetingSlotRecommendation } from "../../agent/domain/agentSchema";

export interface AdhocMeetingModalArgs {
	plugin: PharosPluginLike;
	/** 캘린더에서 특정 날짜 클릭 시 전달 (UI hint). */
	initialDate?: string;
}

// ── [DEMO] AI 미연동 시 사용할 임시 추천 후보 ─────────────────────────────────
// 연동 완료 후 mockRecommendations + demoMode 분기 블록을 제거하세요.
// ──────────────────────────────────────────────────────────────────────────────
const mockRecommendations: MeetingSlotRecommendation[] = [
	{
		day: 2,
		date: "2026-05-26",
		start: "15:00",
		end: "16:00",
		availableMembers: ["유석", "수웅", "우덕", "경석"],
		reason: "전 팀원 가용 + 점심 직후 집중력 높은 시간대",
	},
	{
		day: 3,
		date: "2026-05-27",
		start: "19:00",
		end: "20:00",
		availableMembers: ["유석", "수웅", "우덕"],
		reason: "PM 일정 종료 후 저녁 시간. 일부 팀원 일정 충돌.",
	},
	{
		day: 4,
		date: "2026-05-28",
		start: "10:00",
		end: "11:00",
		availableMembers: ["유석", "수웅", "우덕"],
		reason: "오전 집중 시간. 경석 외 가용.",
	},
];
const MOCK_SUMMARY = "전 팀원 가용 슬롯 1건, 부분 가용 슬롯 2건이 발견되었습니다.";

function Content({
	args,
	onClose,
}: {
	args: AdhocMeetingModalArgs;
	onClose: () => void;
}) {
	const { plugin, initialDate } = args;
	const isDemo = plugin.settings.demoMode;

	// 이번 주 월요일 ISO date (AI 분석 범위).
	const weekStart = useMemo(
		() => mondayOf(initialDate ?? todayISO()),
		[initialDate],
	);

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [recommendations, setRecommendations] = useState<MeetingSlotRecommendation[]>([]);
	const [summary, setSummary] = useState<string>("");
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

	const [customDate, setCustomDate] = useState(initialDate ?? "");
	const [customTime, setCustomTime] = useState("");
	const [topic, setTopic] = useState("");
	const [description, setDescription] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const useCustom = customDate !== "" || customTime !== "";
	const canSubmit =
		topic.trim().length >= 5 &&
		(selectedIndex !== null || (customDate !== "" && customTime !== ""));

	const fetchRecommendations = async (): Promise<void> => {
		setError(null);
		setLoading(true);
		try {
			if (isDemo) {
				// [DEMO] 분기: 실제 API 호출 없이 mock 후보 표시
				await new Promise<void>((resolve) => setTimeout(resolve, 600));
				setRecommendations(mockRecommendations);
				setSummary(MOCK_SUMMARY);
			} else {
				const result = await plugin.agentService.coordinateSchedule({
					weekStart,
					meetingDurationMinutes: 60,
				});
				setRecommendations(result.recommendations);
				setSummary(result.summary);
				if (result.recommendations.length === 0) {
					setError("AI 가 공통 가용시간을 찾지 못했어요. 직접 지정해주세요.");
				}
			}
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (): Promise<void> => {
		if (submitting) return;
		setSubmitting(true);
		try {
			const { date, time, attendees } = await resolveMeetingSlot({
				plugin,
				isDemo,
				recommendations,
				selectedIndex,
				useCustom,
				customDate,
				customTime,
			});

			const meeting = await plugin.meetingsService.create({
				title: topic.trim(),
				date,
				time,
				durationMinutes: 60,
				meetingType: "adhoc",
				attendees,
			});

			const descNote = description.trim() ? ` · ${description.trim()}` : "";
			new Notice(`임시 회의 "${meeting.title}" 생성 완료 (${date} ${time})${descNote}`);
			onClose();
		} catch (err) {
			new Notice(`회의 생성 실패: ${(err as Error).message}`);
			setSubmitting(false);
		}
	};

	const headerHint = summary
		? summary
		: isDemo
			? "[DEMO] 시연용 추천 후보 — 실제 AI 호출 우회"
			: "팀원 가용시간 + 기존 회의 분석. AI API 키 필요.";

	return (
		<ModalLayout
			title="➕ 임시 회의 추가"
			description={`AI 가 ${weekStart} 주 가용시간 기반으로 후보를 제안합니다`}
			submitLabel={submitting ? "생성 중..." : "회의 생성"}
			submitDisabled={!canSubmit || submitting}
			onSubmit={() => void handleSubmit()}
			onCancel={onClose}
			widthClass="max-w-xl"
		>
			<FormField label="✨ AI 추천 시간대" hint={headerHint}>
				{recommendations.length === 0 ? (
					<Button
						variant="secondary"
						onClick={() => void fetchRecommendations()}
						disabled={loading}
						className="w-full"
					>
						{loading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								AI 분석 중...
							</>
						) : (
							<>
								<Sparkles className="mr-2 h-4 w-4" />
								AI 추천 받기
							</>
						)}
					</Button>
				) : (
					<div className="space-y-2">
						{recommendations.map((rec, i) => {
							const selected = selectedIndex === i && !useCustom;
							const onPick = () => {
								setSelectedIndex(i);
								setCustomDate("");
								setCustomTime("");
							};
							return (
								<div
									key={`${rec.date}-${rec.start}-${i}`}
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
										"flex w-full cursor-pointer items-start justify-between rounded-md border p-3 text-left transition-colors",
										selected
											? "border-[color:var(--interactive-accent)]"
											: "border-bg-modifier bg-bg-secondary hover:bg-[color:var(--background-modifier-hover)]",
									)}
									style={
										selected
											? {
													backgroundColor:
														"color-mix(in srgb, var(--interactive-accent) 10%, transparent)",
												}
											: undefined
									}
								>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-text-normal">
											{rec.date} · {rec.start}–{rec.end}
										</p>
										<p className="mt-0.5 text-[11px] text-text-faint">
											참석 가능 {rec.availableMembers.length}명 ·{" "}
											{rec.availableMembers.join(", ")}
										</p>
										<p className="mt-1 text-[11px] text-text-muted">{rec.reason}</p>
									</div>
									<Sparkles className="ml-2 h-4 w-4 shrink-0 text-[color:var(--color-orange)]" />
								</div>
							);
						})}
						<Button
							variant="ghost"
							onClick={() => void fetchRecommendations()}
							disabled={loading}
							className="w-full text-xs"
						>
							{loading ? "..." : "다시 분석"}
						</Button>
					</div>
				)}
				{error && (
					<p className="mt-2 text-xs text-[color:var(--color-red)]">{error}</p>
				)}
			</FormField>

			<FormField label="직접 지정" hint="위 후보 외 시간으로 설정할 때">
				<div className="flex gap-2">
					<input
						type="date"
						className={inputClass}
						value={customDate}
						onChange={(e) => {
							setCustomDate(e.target.value);
							setSelectedIndex(null);
						}}
					/>
					<input
						type="time"
						className={inputClass}
						value={customTime}
						onChange={(e) => {
							setCustomTime(e.target.value);
							setSelectedIndex(null);
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

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function todayISO(): string {
	return new Date().toISOString().slice(0, 10);
}

/** 주어진 date 의 월요일 ISO date. 일요일=0 인 JS 요일 보정. */
function mondayOf(isoDate: string): string {
	const d = new Date(isoDate + "T00:00:00");
	const day = d.getDay();
	const offset = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + offset);
	return d.toISOString().slice(0, 10);
}

/**
 * 제출 시 (추천 슬롯 / 직접 지정) 분기와 attendees 매핑을 한 곳에서 처리.
 *
 * - 추천 슬롯 선택 시: rec.availableMembers (이름 배열) → teamService.listActive() 와 매칭하여 MeetingAttendee 변환
 * - 직접 지정 시: attendees 빈 배열 (후속 흐름에서 PO 가 직접 추가하는 정책)
 * - [DEMO] 분기: mock 후보의 availableMembers 가 실제 팀에 매칭 안 될 수 있으므로 빈 배열 폴백
 */
async function resolveMeetingSlot(params: {
	plugin: PharosPluginLike;
	isDemo: boolean;
	recommendations: MeetingSlotRecommendation[];
	selectedIndex: number | null;
	useCustom: boolean;
	customDate: string;
	customTime: string;
}): Promise<{
	date: string;
	time: string;
	attendees: { id: string; name: string; role: "PO" | "PM"; attended: boolean }[];
}> {
	const {
		plugin,
		isDemo,
		recommendations,
		selectedIndex,
		useCustom,
		customDate,
		customTime,
	} = params;

	const usingRecommendation = selectedIndex !== null && !useCustom;

	if (!usingRecommendation) {
		return { date: customDate, time: customTime, attendees: [] };
	}

	const rec = recommendations[selectedIndex];
	if (!rec) {
		throw new Error("선택한 추천 슬롯을 찾을 수 없습니다");
	}

	if (isDemo) {
		// [DEMO] mock 후보의 멤버 이름은 실제 팀과 매칭 안 될 가능성. 빈 배열로 폴백.
		return { date: rec.date, time: rec.start, attendees: [] };
	}

	const all = await plugin.teamService.listActive();
	const attendees = all
		.filter((m) => rec.availableMembers.includes(m.name))
		.map((m) => ({
			id: m.id,
			name: m.name,
			role: m.role,
			attended: false,
		}));

	return { date: rec.date, time: rec.start, attendees };
}

export class AdhocMeetingModal extends BaseReactModal {
	constructor(
		app: App,
		private readonly plugin: PharosPluginLike,
		private readonly initialDate?: string,
	) {
		super(app);
	}

	renderContent() {
		return (
			<Content
				args={{ plugin: this.plugin, initialDate: this.initialDate }}
				onClose={() => this.close()}
			/>
		);
	}
}
