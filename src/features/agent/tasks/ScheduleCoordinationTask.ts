import type { IAgentTask, AgentContext } from "./IAgentTask";
import type { LLMRequest } from "../domain/llmSchema";
import type {
	ScheduleCoordinationInput,
	ScheduleCoordinationResult,
	MeetingSlotRecommendation,
} from "../domain/agentSchema";
import type { AvailabilitySlot } from "../../availability/domain/availabilitySchema";
import type { Meeting } from "../../meeting/domain/meetingSchema";
import type { Member } from "../../team/domain/teamSchema";

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function dayToDate(weekStart: string, day: number): string {
	const base = new Date(weekStart);
	const offset = day === 0 ? 6 : day - 1;
	base.setDate(base.getDate() + offset);
	return base.toISOString().slice(0, 10);
}

export function addDays(weekStart: string, n: number): string {
	const d = new Date(weekStart);
	d.setDate(d.getDate() + n);
	return d.toISOString().slice(0, 10);
}

export function toMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return (h ?? 0) * 60 + (m ?? 0);
}

export function timesOverlap(
	slotStart: string,
	slotEnd: string,
	meetStart: string,
	durationMinutes: number,
): boolean {
	const sStart = toMinutes(slotStart);
	const sEnd = toMinutes(slotEnd);
	const mStart = toMinutes(meetStart);
	const mEnd = mStart + durationMinutes;
	return sStart < mEnd && sEnd > mStart;
}

export function timesConflictWithBuffer(
	slotStart: string,
	slotEnd: string,
	meetStart: string,
	durationMinutes: number,
	bufferMinutes: number,
): boolean {
	const sStart = toMinutes(slotStart);
	const sEnd = toMinutes(slotEnd);
	const mStart = toMinutes(meetStart);
	const mEnd = mStart + durationMinutes;
	return sStart < mEnd + bufferMinutes && sEnd > mStart - bufferMinutes;
}

// ─── 프롬프트 빌더 ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 팀 일정 조율 전문 AI 에이전트입니다.
팀원별 가용시간과 기존 회의 일정을 분석하여 최적의 회의 시간 후보를 추천합니다.

반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "recommendations": [
    {
      "day": 숫자,
      "start": "HH:MM",
      "end": "HH:MM",
      "availableMembers": ["이름1", "이름2"],
      "reason": "이 시간을 추천하는 구체적인 이유 (한국어)"
    }
  ],
  "summary": "전체 일정 조율 결과 요약 (한국어)"
}

day 값 기준: 0=일요일, 1=월요일, 2=화요일, 3=수요일, 4=목요일, 5=금요일, 6=토요일`;

interface BuildPromptInput {
	weekStart: string;
	participants: Member[];
	slots: AvailabilitySlot[];
	existingMeetings: Meeting[];
	minParticipants: number;
	meetingDurationMinutes: number;
	noCommonSlots: boolean;
}

function buildSchedulePrompt({
	weekStart,
	participants,
	slots,
	existingMeetings,
	minParticipants,
	meetingDurationMinutes,
	noCommonSlots,
}: BuildPromptInput): string {
	const memberSection = participants.map((m) => `- ${m.name} (${m.role})`).join("\n");

	const slotsByMember = new Map<string, AvailabilitySlot[]>();
	for (const slot of slots) {
		const member = participants.find((m) => m.id === slot.memberId);
		if (!member) continue;
		const existing = slotsByMember.get(member.name) ?? [];
		existing.push(slot);
		slotsByMember.set(member.name, existing);
	}

	const availabilitySection =
		slotsByMember.size === 0
			? "등록된 가용시간 없음"
			: Array.from(slotsByMember.entries())
					.map(([name, memberSlots]) => {
						const lines = memberSlots
							.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
							.map(
								(s) =>
									`  ${DAYS_KO[s.day]}요일(day=${s.day}) ${s.start}~${s.end}  [${dayToDate(weekStart, s.day)}]`,
							)
							.join("\n");
						return `${name}:\n${lines}`;
					})
					.join("\n\n");

	const meetingSection =
		existingMeetings.length === 0
			? "없음"
			: existingMeetings
					.map((m) => `- ${m.date} ${m.time} (${m.durationMinutes}분): ${m.title}`)
					.join("\n");

	const commonNote = noCommonSlots
		? `- 주의: 모든 조건을 만족하는 공통 가용시간이 없습니다. 가능한 한 많은 팀원이 참여할 수 있는 최선의 시간대를 추천해 주세요(최소 인원 조건을 충족하지 못해도 됩니다).`
		: `- 최소 ${minParticipants}명 이상이 참여할 수 있는 시간대를 추천해 주세요.`;

	return `=== 팀원 목록 ===
${memberSection}

=== ${weekStart} 주차 팀원별 가용시간 (09:00~21:00, 기존 회의 전후 2시간 제외) ===
${availabilitySection}

=== 기존 회의 일정 (해당 주) ===
${meetingSection}

=== 요청 사항 ===
${commonNote}
- 최대 3개 시간대를 추천해 주세요.
- 각 슬롯은 ${meetingDurationMinutes}분 이상 여유가 있어야 합니다.
- 위 가용시간 내에서만 추천해 주세요.
- 더 많은 팀원이 참여할 수 있는 시간을 우선 추천해 주세요.
- 추천 이유를 구체적으로 한국어로 작성해 주세요.`;
}

// ─── metadata 타입 ─────────────────────────────────────────────────────────────

interface ScheduleMetadata {
	participants: Member[];
}

// ─── Task 구현 ─────────────────────────────────────────────────────────────────

export class ScheduleCoordinationTask
	implements IAgentTask<ScheduleCoordinationInput, ScheduleCoordinationResult>
{
	async buildRequest(
		input: ScheduleCoordinationInput,
		ctx: AgentContext,
	): Promise<LLMRequest> {
		const minParticipants = input.minParticipants ?? 2;
		const meetingDurationMinutes = input.meetingDurationMinutes ?? 60;

		const allMembers = await ctx.teamService.listActive();
		const participants = input.participantIds
			? allMembers.filter((m) => input.participantIds!.includes(m.id))
			: allMembers;

		if (participants.length < minParticipants) {
			throw new Error(
				`일정 조율을 위해 최소 ${minParticipants}명의 활성 팀원이 필요합니다. 현재: ${participants.length}명`,
			);
		}

		const availability = await ctx.availabilityService.getByWeek(input.weekStart);
		const allSlots: AvailabilitySlot[] = availability?.slots ?? [];
		const participantIds = new Set(participants.map((m) => m.id));
		const participantSlots = allSlots.filter((s) => participantIds.has(s.memberId));

		const weekEnd = addDays(input.weekStart, 6);
		const existingMeetings = await ctx.meetingsService.list({
			dateFrom: input.weekStart,
			dateTo: weekEnd,
		});

		const BUSINESS_START = toMinutes("09:00");
		const BUSINESS_END = toMinutes("21:00");
		const BUFFER_MINUTES = 120;

		const cleanSlots = participantSlots.filter((slot) => {
			if (toMinutes(slot.start) < BUSINESS_START || toMinutes(slot.end) > BUSINESS_END) {
				return false;
			}
			const slotDate = dayToDate(input.weekStart, slot.day);
			return !existingMeetings.some(
				(m) =>
					m.date === slotDate &&
					timesConflictWithBuffer(slot.start, slot.end, m.time, m.durationMinutes, BUFFER_MINUTES),
			);
		});

		const noCommonSlots = cleanSlots.length === 0;
		const slotsForAI = noCommonSlots
			? participantSlots.filter(
					(slot) =>
						toMinutes(slot.start) >= BUSINESS_START &&
						toMinutes(slot.end) <= BUSINESS_END,
				)
			: cleanSlots;

		const metadata: ScheduleMetadata = { participants };

		return {
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{
					role: "user",
					content: buildSchedulePrompt({
						weekStart: input.weekStart,
						participants,
						slots: slotsForAI,
						existingMeetings,
						minParticipants,
						meetingDurationMinutes,
						noCommonSlots,
					}),
				},
			],
			jsonMode: true,
			temperature: 0.3,
			metadata,
		};
	}

	parseResponse(
		raw: string,
		request: LLMRequest,
		input: ScheduleCoordinationInput,
	): ScheduleCoordinationResult {
		type RawSchedule = {
			recommendations?: Omit<MeetingSlotRecommendation, "date">[];
			summary?: string;
		};

		let parsed: RawSchedule = {};
		try {
			parsed = JSON.parse(raw) as RawSchedule;
		} catch {
			console.warn("[Pharos Agent] ScheduleCoordinationTask JSON parse failed");
		}

		const { participants } = (request.metadata as ScheduleMetadata) ?? { participants: [] };
		const validMemberNames = new Set(participants.map((m) => m.name));

		const recommendations: MeetingSlotRecommendation[] = (parsed.recommendations ?? []).map(
			(r) => ({
				...r,
				date: dayToDate(input.weekStart, r.day),
				availableMembers: r.availableMembers.filter((name) => validMemberNames.has(name)),
			}),
		);

		return {
			weekStart: input.weekStart,
			recommendations,
			summary: parsed.summary ?? "",
		};
	}
}
