/**
 * AgentService — AI 에이전트 비즈니스 로직 Facade.
 *
 * 다른 Feature의 Service를 주입받아 데이터를 수집·가공한 뒤
 * OpenAI API를 호출하고 결과를 파싱하여 반환한다.
 * Repository를 직접 쓰지 않음 — 항상 Service 레이어를 통해 데이터 접근.
 *
 * 에이전트 기능 목록:
 *   1. coordinateSchedule  — 일정 조율        (현재)
 *   2. generateMinutes     — 회의록 생성       (예정, 의존: 1)
 *   3. analyzeProgress     — 진행 상황 분석    (예정, 의존: 2)
 *   4. researchTopics      — 자료 조사         (예정, 의존: 2)
 *   5. organizeMaterials   — 자료 정리         (예정)
 *   6. breakdownTasks      — 업무 세분화·할당  (예정)
 *   7. summarizeMinutes    — 회의록 요약       (예정, 의존: 2)
 *
 * 사용:
 *   // UI 컴포넌트에서
 *   const result = await plugin.agentService.coordinateSchedule(
 *     { weekStart: "2026-05-04" },
 *     plugin.settings.openaiApiKey,
 *   );
 */

import OpenAI from "openai";
import type { AvailabilitySlot } from "../../availability/domain/availabilitySchema";
import type { Member } from "../../team/domain/teamSchema";
import type { Meeting } from "../../meeting/domain/meetingSchema";
import type { AvailabilityService } from "../../availability/services/availabilityService";
import type { MeetingsService } from "../../meeting/services/meetingsService";
import type { TeamService } from "../../team/services/teamService";
import type {
	MeetingSlotRecommendation,
	ScheduleCoordinationInput,
	ScheduleCoordinationResult,
} from "../domain/agentSchema";

// ─── 상수 ────────────────────────────────────────────────────────────────────

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** AI에게 응답 형식과 역할을 지정하는 시스템 프롬프트. */
const SCHEDULE_SYSTEM_PROMPT = `당신은 팀 일정 조율 전문 AI 에이전트입니다.
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

// ─── Service ─────────────────────────────────────────────────────────────────

export class AgentService {
	constructor(
		private readonly teamService: TeamService,
		private readonly availabilityService: AvailabilityService,
		private readonly meetingsService: MeetingsService,
	) {}

	/**
	 * 일정 조율 에이전트. (에이전트 기능 1번)
	 *
	 * 흐름:
	 *   1. 참여자 목록 확정 (TeamService)
	 *   2. 해당 주차 가용시간 수집 (AvailabilityService)
	 *   3. 기존 회의 일정 조회 (MeetingsService) — 충돌 방지
	 *   4. 기존 회의와 겹치는 슬롯 제거
	 *   5. OpenAI에 컨텍스트 프롬프트 전달 → 최적 시간 추천
	 *   6. 응답 파싱 + 날짜 정보 보강 → 반환
	 *
	 * @param input  조율 조건 (주차, 참여자, 최소 인원, 회의 길이)
	 * @param openaiApiKey  plugin.settings.openaiApiKey 를 UI에서 전달
	 */
	async coordinateSchedule(
		input: ScheduleCoordinationInput,
		openaiApiKey: string,
	): Promise<ScheduleCoordinationResult> {
		if (!openaiApiKey.trim()) {
			throw new Error(
				"OpenAI API 키가 설정되지 않았습니다. Pharos 설정에서 API 키를 입력해주세요.",
			);
		}

		const minParticipants = input.minParticipants ?? 2;
		const meetingDurationMinutes = input.meetingDurationMinutes ?? 60;

		// ── 1. 참여자 목록 ──────────────────────────────────────────────────────
		const allMembers = await this.teamService.listActive();
		const participants = input.participantIds
			? allMembers.filter((m) => input.participantIds!.includes(m.id))
			: allMembers;

		if (participants.length < minParticipants) {
			throw new Error(
				`일정 조율을 위해 최소 ${minParticipants}명의 활성 팀원이 필요합니다. 현재: ${participants.length}명`,
			);
		}

		// ── 2. 해당 주차 가용시간 수집 ──────────────────────────────────────────
		const availability = await this.availabilityService.getByWeek(input.weekStart);
		const allSlots: AvailabilitySlot[] = availability?.slots ?? [];

		// 참여자에 해당하는 슬롯만 필터
		const participantIds = new Set(participants.map((m) => m.id));
		const participantSlots = allSlots.filter((s) => participantIds.has(s.memberId));

		// ── 3. 기존 회의 일정 조회 (해당 주차) ─────────────────────────────────
		const weekEnd = addDays(input.weekStart, 6);
		const existingMeetings = await this.meetingsService.list({
			dateFrom: input.weekStart,
			dateTo: weekEnd,
		});

		// ── 4. 기존 회의와 충돌하는 슬롯 제거 ─────────────────────────────────
		const cleanSlots = participantSlots.filter((slot) => {
			const slotDate = dayToDate(input.weekStart, slot.day);
			return !existingMeetings.some(
				(m) =>
					m.date === slotDate &&
					timesOverlap(slot.start, slot.end, m.time, m.durationMinutes),
			);
		});

		// ── 5. 프롬프트 구성 + OpenAI 호출 ────────────────────────────────────
		const prompt = buildSchedulePrompt({
			weekStart: input.weekStart,
			participants,
			slots: cleanSlots,
			existingMeetings,
			minParticipants,
			meetingDurationMinutes,
		});

		// Obsidian은 Electron renderer 환경이므로 dangerouslyAllowBrowser 필요
		const openai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });

		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{ role: "system", content: SCHEDULE_SYSTEM_PROMPT },
				{ role: "user", content: prompt },
			],
			response_format: { type: "json_object" },
			temperature: 0.3, // 일정 추천은 일관성이 중요하므로 낮게 설정
		});

		// ── 6. 응답 파싱 + 날짜 보강 ──────────────────────────────────────────
		const content = response.choices[0]?.message?.content ?? "{}";
		const raw = JSON.parse(content) as {
			recommendations?: Omit<MeetingSlotRecommendation, "date">[];
			summary?: string;
		};

		// AI가 반환한 멤버 이름이 실제 참여자 목록에 있는지 검증
		const validMemberNames = new Set(participants.map((m) => m.name));
		const recommendations: MeetingSlotRecommendation[] = (raw.recommendations ?? []).map(
			(r) => ({
				...r,
				date: dayToDate(input.weekStart, r.day),
				availableMembers: r.availableMembers.filter((name) => validMemberNames.has(name)),
			}),
		);

		return {
			weekStart: input.weekStart,
			recommendations,
			summary: raw.summary ?? "",
		};
	}
}

// ─── 순수 헬퍼 함수 ──────────────────────────────────────────────────────────

/**
 * weekStart(월요일 ISO date)와 day(0=일~6=토)로 해당 날짜를 계산.
 *
 * weekStart가 월요일(day=1)이므로:
 *   day=0(일) → +6일 (주의 마지막 일요일)
 *   day=1(월) → +0일 (weekStart 당일)
 *   day=2(화) → +1일
 *   ...
 *   day=6(토) → +5일
 */
export function dayToDate(weekStart: string, day: number): string {
	const base = new Date(weekStart);
	const offset = day === 0 ? 6 : day - 1;
	base.setDate(base.getDate() + offset);
	return base.toISOString().slice(0, 10);
}

/** weekStart에서 n일 후의 ISO date. */
export function addDays(weekStart: string, n: number): string {
	const d = new Date(weekStart);
	d.setDate(d.getDate() + n);
	return d.toISOString().slice(0, 10);
}

/** "HH:MM" → 분 단위 정수. */
export function toMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * 슬롯 [slotStart, slotEnd)와 회의 [meetStart, meetStart+duration) 의 시간 겹침 여부.
 * 끝 시각이 정확히 일치하는 경우(인접)는 겹침으로 보지 않음.
 */
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

// ─── 프롬프트 빌더 ───────────────────────────────────────────────────────────

interface PromptInput {
	weekStart: string;
	participants: Member[];
	slots: AvailabilitySlot[];
	existingMeetings: Meeting[];
	minParticipants: number;
	meetingDurationMinutes: number;
}

/** OpenAI user 프롬프트 구성. */
function buildSchedulePrompt({
	weekStart,
	participants,
	slots,
	existingMeetings,
	minParticipants,
	meetingDurationMinutes,
}: PromptInput): string {
	// 팀원 목록
	const memberSection = participants.map((m) => `- ${m.name} (${m.role})`).join("\n");

	// 팀원별 가용시간
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

	// 기존 회의 목록
	const meetingSection =
		existingMeetings.length === 0
			? "없음"
			: existingMeetings
					.map((m) => `- ${m.date} ${m.time} (${m.durationMinutes}분): ${m.title}`)
					.join("\n");

	return `=== 팀원 목록 ===
${memberSection}

=== ${weekStart} 주차 팀원별 가용시간 (기존 회의와 충돌 제거 후) ===
${availabilitySection}

=== 기존 회의 일정 (해당 주) ===
${meetingSection}

=== 요청 사항 ===
- 최소 ${minParticipants}명 이상이 참여할 수 있는 시간대를 최대 3개 추천해 주세요.
- 각 슬롯은 ${meetingDurationMinutes}분 이상 여유가 있어야 합니다.
- 기존 회의와 겹치는 시간은 이미 제거되었습니다. 위 가용시간 내에서만 추천해 주세요.
- 더 많은 팀원이 참여할 수 있는 시간을 우선 추천해 주세요.
- 추천 이유를 구체적으로 한국어로 작성해 주세요.`;
}
