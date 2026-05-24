/**
 * AgentService — AI 에이전트 비즈니스 로직 Facade.
 *
 * 다른 Feature의 Service를 주입받아 데이터를 수집·가공한 뒤
 * OpenAI(또는 Tavily) API를 호출하고 결과를 파싱하여 반환한다.
 * Repository를 직접 쓰지 않음 — 항상 Service 레이어를 통해 데이터 접근.
 *
 * 에이전트 기능 목록:
 *   1. coordinateSchedule  — 일정 조율        (PO-4)
 *   2. analyzeMinutes      — 회의록 분석       (PO-5)
 *   3. analyzeProgress     — 진행 상황 분석    (PO-12)
 *   4. collectResources    — 자료 조사         (PO-3)
 *   6. breakdownTask       — 업무 세분화·할당  (PO-11)
 *   7. summarizeMinutes    — 회의록 요약       (PO-5 확장, 의존: 2)
 */

import OpenAI from "openai";

// ─── Feature 서비스 의존성 ────────────────────────────────────────────────────
import type { AvailabilityService } from "../../availability/services/availabilityService";
import type { MeetingsService } from "../../meeting/services/meetingsService";
import type { ProgressService } from "../../progress/services/progressService";
import type { RoadmapService } from "../../roadmap/services/roadmapService";
import type { TaskService } from "../../task/services/taskService";
import type { TeamService } from "../../team/services/teamService";

// ─── 도메인 타입 ─────────────────────────────────────────────────────────────
import type { AvailabilitySlot } from "../../availability/domain/availabilitySchema";
import type { Meeting } from "../../meeting/domain/meetingSchema";
import type { Member } from "../../team/domain/teamSchema";
import type { Task } from "../../task/domain/taskSchema";
import type { Roadmap } from "../../roadmap/domain/roadmapSchema";
import type {
	MemberProgressSummary,
	TaskProgressSummary,
} from "../../progress/services/progressService";

// ─── Agent 스키마 타입 ────────────────────────────────────────────────────────
import type {
	ChecklistSuggestion,
	CollectedResource,
	MeetingSlotRecommendation,
	MemberHighlight,
	MinutesAnalysisInput,
	MinutesAnalysisResult,
	MinutesSummaryActionItem,
	MinutesSummaryInput,
	MinutesSummaryResult,
	ProgressAnalysisInput,
	ProgressAnalysisResult,
	ProgressInsight,
	ResourceCollectionInput,
	ResourceCollectionResult,
	ScheduleCoordinationInput,
	ScheduleCoordinationResult,
	TaskBreakdownInput,
	TaskBreakdownResult,
} from "../domain/agentSchema";

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 1. 일정 조율 — 상수 & 헬퍼 ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

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

interface SchedulePromptInput {
	weekStart: string;
	participants: Member[];
	slots: AvailabilitySlot[];
	existingMeetings: Meeting[];
	minParticipants: number;
	meetingDurationMinutes: number;
	noCommonSlots: boolean;
}

/** weekStart(월요일 ISO date)와 day(0=일~6=토)로 해당 날짜를 계산. */
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

/** 슬롯-회의 시간 겹침 여부 (인접은 겹침 아님). */
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

/** BR-5: bufferMinutes 포함한 슬롯-회의 충돌 여부. */
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

function buildSchedulePrompt({
	weekStart,
	participants,
	slots,
	existingMeetings,
	minParticipants,
	meetingDurationMinutes,
	noCommonSlots,
}: SchedulePromptInput): string {
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 2. 회의록 분석 — 상수 & 헬퍼 ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const STOPWORDS = new Set([
	"그리고", "그러나", "하지만", "이것", "저것", "우리", "회의", "내용",
	"관련", "진행", "논의", "있다", "없다", "한다", "된다", "이다",
	"있는", "그", "것", "수", "및", "등", "를", "을", "이", "가",
]);

function buildMinutesPrompt(minutesText: string): string {
	return [
		"당신은 회의록을 분석하는 PM 어시스턴트입니다.",
		"",
		"아래 회의록을 분석하고 반드시 유효한 JSON만 반환하세요.",
		"",
		"## 회의록",
		minutesText,
		"",
		"## 응답 형식",
		JSON.stringify(
			{
				keywords: ["핵심 키워드1", "핵심 키워드2"],
				techStacks: ["기술명1", "기술명2"],
				decisions: ["결정사항1", "결정사항2"],
				summary: "회의 핵심 내용 1~2문장 요약",
			},
			null,
			2,
		),
		"",
		"## 규칙",
		"- keywords: 회의의 핵심 키워드 5개 이내. 일반 동사·부사 제외",
		"- techStacks: 회의록에 명시적으로 언급된 기술·도구만 포함. 추론 금지 (PO-5-BR-3)",
		"- decisions: '결정', '확정', '합의', '채택' 등이 포함된 문장. 없으면 빈 배열",
		"- summary: 핵심 내용 1~2문장, 한국어",
		"- 모든 텍스트는 한국어로 작성",
	].join("\n");
}

/** PO-5-BR-2 fallback: AI 키워드 3개 미만이면 빈도 기반 보완 (시나리오 5a). */
function supplementKeywords(text: string, existing: string[]): string[] {
	if (existing.length >= 3) return existing;
	const freq = new Map<string, number>();
	for (const w of text.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)) {
		if (w.length >= 2 && !STOPWORDS.has(w)) {
			freq.set(w, (freq.get(w) ?? 0) + 1);
		}
	}
	const additional = [...freq.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([w]) => w)
		.filter((w) => !existing.includes(w))
		.slice(0, 3 - existing.length);
	return [...existing, ...additional];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 3. 진행 상황 분석 — 헬퍼 ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

interface ChecklistStats {
	total: number;
	checked: number;
	rate: number | null;
}

interface CommitStats {
	tasksWithCommits: number;
	verifiedTasks: number;
}

interface MemberTwoAxisStats {
	verifiedTaskCount: number;
	userCheckedCount: number;
}

function buildProgressPrompt(
	asOf: string,
	taskSummary: TaskProgressSummary,
	memberSummaries: MemberProgressSummary[],
	blockedTasks: Task[],
	roadmap: Roadmap | null,
	memberMap: Map<string, string>,
	checklistStats: ChecklistStats,
	commitStats: CommitStats,
	memberStatsMap: Map<string, MemberTwoAxisStats>,
): string {
	const lines: string[] = [
		"당신은 소프트웨어 프로젝트의 진행 상황을 분석하는 PM 어시스턴트입니다.",
		"",
		`오늘 날짜: ${asOf}`,
		"",
		"## 전체 Task 요약",
		`- 총 Task: ${taskSummary.total}개`,
		`- 할 일(ToDo): ${taskSummary.todo}개`,
		`- 진행 중: ${taskSummary.inProgress}개`,
		`- 완료: ${taskSummary.done}개`,
		`- 블록됨: ${taskSummary.blocked}개`,
		`- Task 완료율: ${taskSummary.completionRate}%`,
		"",
	];

	if (checklistStats.total > 0) {
		lines.push("## 체크리스트 진행도 (PM-3 체크 데이터)");
		lines.push(`- 전체 체크리스트 항목: ${checklistStats.total}개`);
		lines.push(`- 완료된 항목: ${checklistStats.checked}개 (${checklistStats.rate ?? 0}%)`);
		lines.push("");
	}

	if (commitStats.tasksWithCommits > 0) {
		lines.push("## 커밋 검증 현황 (PM-4 검증 데이터)");
		lines.push(`- 커밋이 연결된 Task: ${commitStats.tasksWithCommits}개`);
		lines.push(`- 검증 완료(verified) Task: ${commitStats.verifiedTasks}개`);
		lines.push(`- 미검증 Task: ${commitStats.tasksWithCommits - commitStats.verifiedTasks}개`);
		lines.push("");
	}

	if (roadmap && roadmap.phases.length > 0) {
		lines.push("## 개발 로드맵 단계");
		for (const phase of roadmap.phases) {
			lines.push(`- ${phase.name}: ${phase.start} ~ ${phase.end} (${phase.status})`);
		}
		lines.push("");
	}

	if (blockedTasks.length > 0) {
		lines.push("## 블록된 Task");
		for (const t of blockedTasks) {
			lines.push(`- ${t.id}: ${t.title}`);
		}
		lines.push("");
	}

	if (memberSummaries.length > 0) {
		lines.push("## 팀원별 진행 현황 (PO-12 2축: 효성도 + 완료체크)");
		for (const m of memberSummaries) {
			const name = memberMap.get(m.memberId) ?? m.memberId;
			const rate = m.total === 0 ? 0 : Math.round((m.done / m.total) * 100);
			const stats = memberStatsMap.get(m.memberId);
			const twoAxis = stats
				? `, 검증커밋 Task ${stats.verifiedTaskCount}개(효성도), 완료체크 ${stats.userCheckedCount}개`
				: "";
			lines.push(
				`- ${name}(${m.memberId}): ${m.done}/${m.total}개 완료 (${rate}%), 진행중 ${m.inProgress}개${twoAxis}`,
			);
		}
		lines.push("");
	}

	const memberHighlightExample =
		memberSummaries.length > 0
			? memberSummaries.map((m) => ({ memberId: m.memberId, highlight: "한국어 한 줄 요약" }))
			: [{ memberId: "m1", highlight: "한국어 한 줄 요약" }];

	lines.push(
		"위 데이터를 기반으로 프로젝트 상태를 분석하고 아래 JSON 형식으로 응답해주세요.",
		"반드시 유효한 JSON만 반환하세요.",
		"",
		"응답 형식:",
		JSON.stringify(
			{
				overallHealth: "on-track | at-risk | critical",
				insights: [{ type: "milestone | risk | achievement | recommendation", message: "한국어 분석 내용", relatedTaskIds: ["TASK-1"] }],
				memberHighlights: memberHighlightExample,
				summary: "한국어 2-3문장 전체 요약",
			},
			null,
			2,
		),
		"",
		"규칙:",
		"- overallHealth: 일정대로 진행 중이면 'on-track', 블로커·지연 위험이 있으면 'at-risk', 심각한 지연이면 'critical'",
		"- insights: 3~5개. type은 milestone/risk/achievement/recommendation 중 선택",
		"- relatedTaskIds는 관련 Task가 있을 때만 포함",
		"- memberHighlights: 모든 팀원 포함. completionRate는 포함하지 말 것 (시스템이 실데이터로 계산)",
		"- ❌ AI 추정 비율 표현 금지: '약 X% 완료', '절반 정도 진행' 같은 표현 금지",
		"- ✅ 실제 집계 수치 인용 허용: 'N개 중 M개 완료', 'blocked Task N개' 등",
		"- 모든 텍스트(message, highlight, summary)는 한국어로 작성",
	);

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 4. 자료 조사 — 헬퍼 ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

interface TavilySearchResult {
	title: string;
	url: string;
	content: string;
	score: number;
}

/**
 * Tavily API 호출. 실패 시 5초 대기 후 최대 3회 재시도 (시나리오 5a).
 * 3회 모두 실패하면 throw.
 */
async function callTavily(
	query: string,
	apiKey: string,
	maxResults: number,
): Promise<TavilySearchResult[]> {
	const MAX_ATTEMPTS = 3;
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		try {
			const resp = await fetch("https://api.tavily.com/search", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({ query, search_depth: "basic", max_results: maxResults }),
			});
			if (!resp.ok) throw new Error(`Tavily HTTP ${resp.status}`);
			const data = (await resp.json()) as { results?: TavilySearchResult[] };
			return data.results ?? [];
		} catch (e) {
			if (attempt === MAX_ATTEMPTS - 1) throw e;
			await new Promise<void>((resolve) => setTimeout(resolve, 5000));
		}
	}
	return [];
}

/** 주제별 검색 쿼리 2개 생성. 실패 시 주제명 그대로 반환 (시나리오 3a). */
async function generateSearchQueries(
	topic: { title: string; description?: string },
	openai: OpenAI,
): Promise<string[]> {
	const lines = [
		`회의 주제: ${topic.title}`,
		topic.description ? `주제 설명: ${topic.description}` : "",
		"",
		"위 주제에 관한 웹 검색 쿼리를 2개 생성해주세요.",
		'반드시 유효한 JSON만 반환하세요: { "queries": ["쿼리1", "쿼리2"] }',
	].filter(Boolean);

	try {
		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: lines.join("\n") }],
			response_format: { type: "json_object" },
			temperature: 0.3,
		});
		const raw = completion.choices[0]?.message?.content ?? "{}";
		const parsed = JSON.parse(raw) as { queries?: string[] };
		const queries = (parsed.queries ?? []).filter(Boolean);
		return queries.length > 0 ? queries : [topic.title];
	} catch {
		return [topic.title];
	}
}

/** 웹 자료 내용을 한국어로 요약 (3~5문장). 실패 시 원문 앞 500자 (시나리오 6a). */
async function summarizeContent(
	title: string,
	content: string,
	openai: OpenAI,
): Promise<string> {
	try {
		const prompt = [
			"아래 웹 자료를 3~5문장으로 한국어 요약하세요.",
			`제목: ${title}`,
			`내용: ${content.slice(0, 2000)}`,
		].join("\n");
		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: prompt }],
			temperature: 0.3,
			max_tokens: 300,
		});
		return completion.choices[0]?.message?.content?.trim() ?? content.slice(0, 500);
	} catch {
		return content.slice(0, 500);
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 6. 업무 세분화 — 상수 & 헬퍼 ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const TASK_BREAKDOWN_SYSTEM_PROMPT = `당신은 소프트웨어 개발 업무 세분화 전문 AI 에이전트입니다.
주어진 Task를 구체적이고 실행 가능한 체크리스트 항목으로 쪼갭니다.

반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "items": [
    {
      "text": "세부 작업 내용 (한국어, 간결하게)",
      "reason": "이 항목이 필요한 이유 (한국어)"
    }
  ],
  "summary": "전체 세분화 결과 요약 (한국어)"
}

규칙:
- 항목은 최소 5개, 최대 7개
- 각 항목은 1명이 하루~이틀 안에 완료할 수 있는 단위
- 기술 스택이 주어지면 해당 기술에 맞는 구체적 작업으로 세분화
- 테스트 항목도 반드시 포함`;

function buildTaskBreakdownPrompt(input: TaskBreakdownInput): string {
	const lines: string[] = [
		"=== Task 정보 ===",
		`Task ID: ${input.taskId}`,
		`제목: ${input.taskTitle}`,
	];
	if (input.taskDescription?.trim()) {
		lines.push(`설명: ${input.taskDescription}`);
	}
	if (input.techStack && input.techStack.length > 0) {
		lines.push(`기술 스택: ${input.techStack.join(", ")}`);
	}
	lines.push(
		"",
		"=== 요청 사항 ===",
		"위 Task를 체크리스트 항목으로 세분화해주세요.",
		"각 항목은 PM이 1~2일 내 완료할 수 있는 구체적 작업이어야 합니다.",
	);
	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 7. 회의록 요약 — 상수 & 헬퍼 ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const MINUTES_SUMMARY_SYSTEM_PROMPT = `당신은 회의록을 분석하여 구조화된 요약을 생성하는 PM 어시스턴트입니다.

반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "executiveSummary": "2~3문장 전체 회의 요약 (한국어)",
  "keyPoints": ["핵심 논의 포인트1 (한국어)", "핵심 논의 포인트2"],
  "decisions": ["결정사항1 (한국어)", "결정사항2"],
  "actionItems": [
    { "assignee": "담당자명 또는 팀 전체", "task": "수행할 작업 (한국어)" }
  ],
  "suggestedTopics": ["다음 회의 주제 후보1 (한국어)", "다음 회의 주제 후보2"]
}

규칙:
- executiveSummary: 2~3문장. 회의 목적·핵심 논의·주요 결과를 포함
- keyPoints: 3~7개. 회의에서 논의된 주요 포인트
- decisions: "결정", "확정", "합의", "채택" 등 확실한 결정사항만. 없으면 빈 배열
- actionItems: 누가 무엇을 해야 하는지 명확한 항목만. 담당자 불명확하면 "팀 전체". 없으면 빈 배열
- suggestedTopics: 이번 회의 내용·미결사항을 바탕으로 다음 회의에서 다룰 3~5개 주제 (PO-2 입력용)
- % 진척도 표현 금지
- 모든 텍스트는 한국어로 작성`;

const MAX_MINUTES_LENGTH = 6000;

function buildMinutesSummaryPrompt(meeting: Meeting): string {
	const lines: string[] = [
		"=== 회의 정보 ===",
		`제목: ${meeting.title}`,
		`날짜: ${meeting.date} ${meeting.time}`,
		`참석자: ${meeting.attendees.map((a) => `${a.name}(${a.role})`).join(", ")}`,
	];

	if (meeting.topics.length > 0) {
		lines.push(`논의 주제: ${meeting.topics.map((t) => t.title).join(", ")}`);
	}

	const minutesContent = meeting.minutes!.content;
	const truncated = minutesContent.length > MAX_MINUTES_LENGTH;
	lines.push(
		"",
		"=== 회의록 원문 ===",
		truncated ? minutesContent.slice(0, MAX_MINUTES_LENGTH) + "\n...(이하 생략)" : minutesContent,
	);

	if (meeting.analysis) {
		lines.push("", "=== 기존 AI 분석 결과 (참고용) ===");
		if (meeting.analysis.keywords.length > 0) {
			lines.push(`핵심 키워드: ${meeting.analysis.keywords.join(", ")}`);
		}
		if (meeting.analysis.techStacks.length > 0) {
			lines.push(`기술 스택: ${meeting.analysis.techStacks.join(", ")}`);
		}
		if (meeting.analysis.decisions.length > 0) {
			lines.push(`결정사항 (기추출): ${meeting.analysis.decisions.join("; ")}`);
		}
	}

	lines.push(
		"",
		"=== 요청 ===",
		"위 회의록을 분석하여 구조화된 요약을 생성해주세요.",
		"특히 다음 회의에서 다뤄야 할 suggestedTopics를 3~5개 추천해주세요.",
	);

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── AgentService ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export class AgentService {
	constructor(
		private readonly teamService: TeamService,
		private readonly availabilityService: AvailabilityService,
		private readonly meetingsService: MeetingsService,
		private readonly progressService: ProgressService,
		private readonly taskService: TaskService,
		private readonly roadmapService: RoadmapService,
	) {}

	// ─── 1. 일정 조율 (PO-4) ──────────────────────────────────────────────────

	/**
	 * 팀원 가용시간·기존 회의를 분석해 최적 회의 시간 후보 3개를 추천.
	 *
	 * BR-2: 09:00~21:00 영업 시간 이내만.
	 * BR-5: 기존 회의 전후 2시간 버퍼.
	 * UC 3a: 공통 슬롯 없으면 최선 부분 매칭.
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

		const allMembers = await this.teamService.listActive();
		const participants = input.participantIds
			? allMembers.filter((m) => input.participantIds!.includes(m.id))
			: allMembers;

		if (participants.length < minParticipants) {
			throw new Error(
				`일정 조율을 위해 최소 ${minParticipants}명의 활성 팀원이 필요합니다. 현재: ${participants.length}명`,
			);
		}

		const availability = await this.availabilityService.getByWeek(input.weekStart);
		const allSlots: AvailabilitySlot[] = availability?.slots ?? [];
		const participantIds = new Set(participants.map((m) => m.id));
		const participantSlots = allSlots.filter((s) => participantIds.has(s.memberId));

		const weekEnd = addDays(input.weekStart, 6);
		const existingMeetings = await this.meetingsService.list({
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

		const prompt = buildSchedulePrompt({
			weekStart: input.weekStart,
			participants,
			slots: slotsForAI,
			existingMeetings,
			minParticipants,
			meetingDurationMinutes,
			noCommonSlots,
		});

		const openai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });
		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{ role: "system", content: SCHEDULE_SYSTEM_PROMPT },
				{ role: "user", content: prompt },
			],
			response_format: { type: "json_object" },
			temperature: 0.3,
		});

		const content = response.choices[0]?.message?.content ?? "{}";
		type RawSchedule = {
			recommendations?: Omit<MeetingSlotRecommendation, "date">[];
			summary?: string;
		};
		let raw: RawSchedule = {};
		try {
			raw = JSON.parse(content) as RawSchedule;
		} catch {
			// JSON 파싱 실패 시 빈 결과로 처리
		}

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

	// ─── 2. 회의록 분석 (PO-5) ────────────────────────────────────────────────

	/**
	 * 회의록 텍스트를 분석해 키워드·기술스택·결정사항·요약 추출.
	 *
	 * 시나리오 2a: 텍스트 50자 미만 → throw.
	 * 시나리오 5a: 키워드 3개 미만 → 빈도 기반 보완.
	 * PO-5-BR-3: 명시된 기술만 추출 (추론 금지).
	 */
	async analyzeMinutes(
		input: MinutesAnalysisInput,
		openaiApiKey: string,
	): Promise<MinutesAnalysisResult> {
		if (!openaiApiKey) throw new Error("OpenAI API 키가 설정되지 않았습니다");
		if (input.minutesText.trim().length < 50) {
			throw new Error("회의록 내용이 부족합니다. 최소 50자 이상 입력해주세요.");
		}

		const meeting = await this.meetingsService.getById(input.meetingId);
		if (!meeting) {
			throw new Error(`회의 ${input.meetingId}를 찾을 수 없습니다`);
		}

		const openai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });
		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: buildMinutesPrompt(input.minutesText) }],
			response_format: { type: "json_object" },
			temperature: 0.3,
		});

		const raw = completion.choices[0]?.message?.content ?? "{}";
		type ParsedMinutes = {
			keywords?: string[];
			techStacks?: string[];
			decisions?: string[];
			summary?: string;
		};
		let parsed: ParsedMinutes = {};
		try {
			parsed = JSON.parse(raw) as ParsedMinutes;
		} catch {
			// JSON 파싱 실패 시 빈 객체로 fallback
		}

		const rawKeywords = (parsed.keywords ?? []).filter(Boolean);
		const keywords = supplementKeywords(input.minutesText, rawKeywords);

		return {
			meetingId: input.meetingId,
			keywords,
			techStacks: (parsed.techStacks ?? []).filter(Boolean),
			decisions: (parsed.decisions ?? []).filter(Boolean),
			summary: parsed.summary ?? "",
		};
	}

	// ─── 3. 진행 상황 분석 (PO-12) ────────────────────────────────────────────

	/**
	 * Task 현황·체크리스트(PM-3)·커밋 검증(PM-4)·로드맵 단계·팀원 기여도를
	 * 종합해 프로젝트 건강도를 진단.
	 *
	 * PO-12 2축: 효성도(verifiedTaskCount) + 완료체크(userCheckedCount).
	 * % 진척도 AI 추정 금지 — 실데이터 기반 계산만.
	 */
	async analyzeProgress(
		input: ProgressAnalysisInput,
		openaiApiKey: string,
	): Promise<ProgressAnalysisResult> {
		if (!openaiApiKey.trim()) {
			throw new Error("OpenAI API 키가 설정되지 않았습니다.");
		}

		const {
			asOf = new Date().toISOString().slice(0, 10),
			includeBlocked = true,
			includeMemberDetails = true,
		} = input;

		const taskSummary = await this.progressService.getTaskSummary();
		const memberSummaries = includeMemberDetails
			? await this.progressService.getMemberSummaries()
			: [];
		const allTasks = await this.taskService.list();
		const blockedTasks = includeBlocked
			? allTasks.filter((t) => t.status === "blocked")
			: [];

		const checklistTotal = allTasks.reduce((sum, t) => sum + (t.checklist?.length ?? 0), 0);
		const checklistChecked = allTasks.reduce(
			(sum, t) => sum + (t.checklist?.filter((c) => c.checked).length ?? 0),
			0,
		);
		const checklistStats: ChecklistStats = {
			total: checklistTotal,
			checked: checklistChecked,
			rate: checklistTotal === 0 ? null : Math.round((checklistChecked / checklistTotal) * 100),
		};

		const tasksWithCommits = allTasks.filter((t) => (t.linkedCommits?.length ?? 0) > 0);
		const verifiedTaskCount = tasksWithCommits.filter((t) =>
			t.linkedCommits.some((c) => c.verifyResult === "verified"),
		).length;
		const commitStats: CommitStats = {
			tasksWithCommits: tasksWithCommits.length,
			verifiedTasks: verifiedTaskCount,
		};

		const roadmap = await this.roadmapService.getDevelopment();
		const members = await this.teamService.listActive();
		const memberMap = new Map(members.map((m) => [m.id, m.name]));

		const memberStatsMap = new Map<string, MemberTwoAxisStats>();
		for (const m of memberSummaries) {
			const memberTasks = allTasks.filter((t) => t.assignee?.id === m.memberId);
			memberStatsMap.set(m.memberId, {
				verifiedTaskCount: memberTasks.filter((t) =>
					t.linkedCommits.some((c) => c.verifyResult === "verified"),
				).length,
				userCheckedCount: memberTasks.filter((t) => t.userChecked).length,
			});
		}

		const prompt = buildProgressPrompt(
			asOf,
			taskSummary,
			memberSummaries,
			blockedTasks,
			roadmap,
			memberMap,
			checklistStats,
			commitStats,
			memberStatsMap,
		);

		const openai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });
		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: prompt }],
			response_format: { type: "json_object" },
			temperature: 0.3,
		});

		const rawStr = completion.choices[0]?.message?.content ?? "{}";
		type ParsedProgress = {
			overallHealth?: "on-track" | "at-risk" | "critical";
			insights?: Array<{ type?: string; message?: string; relatedTaskIds?: string[] }>;
			memberHighlights?: Array<{ memberId?: string; highlight?: string }>;
			summary?: string;
		};
		let parsed: ParsedProgress = {};
		try {
			parsed = JSON.parse(rawStr) as ParsedProgress;
		} catch {
			// JSON 파싱 실패 시 빈 객체로 fallback
		}

		const validInsightTypes = new Set(["milestone", "risk", "achievement", "recommendation"]);
		const insights: ProgressInsight[] = (parsed.insights ?? []).map((i) => ({
			type: (validInsightTypes.has(i.type ?? "")
				? i.type
				: "recommendation") as ProgressInsight["type"],
			message: i.message ?? "",
			...(i.relatedTaskIds?.length ? { relatedTaskIds: i.relatedTaskIds } : {}),
		}));

		const memberHighlights: MemberHighlight[] = (parsed.memberHighlights ?? []).map((h) => {
			const memberId = h.memberId ?? "";
			const ms = memberSummaries.find((m) => m.memberId === memberId);
			const stats = memberStatsMap.get(memberId);
			const completionRate = ms && ms.total > 0 ? Math.round((ms.done / ms.total) * 100) : 0;
			return {
				memberId,
				memberName: memberMap.get(memberId) ?? memberId,
				completionRate,
				verifiedTaskCount: stats?.verifiedTaskCount ?? 0,
				userCheckedCount: stats?.userCheckedCount ?? 0,
				highlight: h.highlight ?? "",
			};
		});

		return {
			asOf,
			overallHealth: parsed.overallHealth ?? "at-risk",
			completionRate: taskSummary.completionRate,
			checklistCompletionRate: checklistStats.rate,
			verifiedTaskCount,
			insights,
			blockedTasks: blockedTasks.map((t) => ({ id: t.id, title: t.title })),
			memberHighlights,
			summary: parsed.summary ?? "",
		};
	}

	// ─── 4. 자료 조사 (PO-3) ──────────────────────────────────────────────────

	/**
	 * 확정된 주제별 Tavily 검색 → 자료 수집 → OpenAI 요약.
	 *
	 * 시나리오 3a: 쿼리 생성 실패 → 주제명 대체.
	 * 시나리오 5a: Tavily 실패 → 5초 대기 후 3회 재시도.
	 * 시나리오 5b: 결과 없음 → 주제명 대체 검색.
	 * 시나리오 6a: 요약 실패 → 원문 앞 500자.
	 */
	async collectResources(
		input: ResourceCollectionInput,
		openaiApiKey: string,
		tavilyApiKey: string,
	): Promise<ResourceCollectionResult> {
		if (!tavilyApiKey) throw new Error("Tavily API 키가 설정되지 않았습니다");

		const { meetingId, maxResultsPerQuery = 5 } = input;

		let topics = input.topics;
		if (!topics || topics.length === 0) {
			const meeting = await this.meetingsService.getById(meetingId);
			if (!meeting) throw new Error(`회의 ${meetingId}를 찾을 수 없습니다`);
			topics = meeting.topics.map((t) => ({
				id: t.id,
				title: t.title,
				description: t.description,
			}));
		}

		const openai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });
		const resources: CollectedResource[] = [];
		const failedTopics: string[] = [];

		for (const topic of topics) {
			try {
				const queries = await generateSearchQueries(topic, openai);
				const seenUrls = new Set<string>();

				for (const query of queries) {
					let results: TavilySearchResult[];
					try {
						results = await callTavily(query, tavilyApiKey, maxResultsPerQuery);
					} catch {
						continue;
					}

					if (results.length === 0 && query !== topic.title) {
						try {
							results = await callTavily(topic.title, tavilyApiKey, maxResultsPerQuery);
						} catch {
							continue;
						}
					}

					for (const item of results) {
						if (seenUrls.has(item.url)) continue;
						seenUrls.add(item.url);
						const summary = await summarizeContent(item.title, item.content, openai);
						resources.push({ topicId: topic.id, title: item.title, summary, sourceUrl: item.url });
					}
				}
			} catch {
				failedTopics.push(topic.id);
			}
		}

		return { meetingId, resources, totalCollected: resources.length, failedTopics };
	}

	// ─── 6. 업무 세분화 (PO-11) ───────────────────────────────────────────────

	/**
	 * Task를 5~7개 체크리스트로 세분화.
	 * 기술스택 반영, 테스트 항목 강제 포함.
	 */
	async breakdownTask(
		input: TaskBreakdownInput,
		openaiApiKey: string,
	): Promise<TaskBreakdownResult> {
		if (!openaiApiKey.trim()) {
			throw new Error(
				"OpenAI API 키가 설정되지 않았습니다. Pharos 설정에서 API 키를 입력해주세요.",
			);
		}

		const prompt = buildTaskBreakdownPrompt(input);
		const openai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });

		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{ role: "system", content: TASK_BREAKDOWN_SYSTEM_PROMPT },
				{ role: "user", content: prompt },
			],
			response_format: { type: "json_object" },
			temperature: 0.4,
		});

		const content = response.choices[0]?.message?.content ?? "{}";
		type RawBreakdown = { items?: { text: string; reason: string }[]; summary?: string };
		let raw: RawBreakdown = {};
		try {
			raw = JSON.parse(content) as RawBreakdown;
		} catch {
			// JSON 파싱 실패 시 빈 결과로 처리
		}

		const items: ChecklistSuggestion[] = (raw.items ?? [])
			.filter((it) => it.text?.trim())
			.map((it) => ({ text: it.text.trim(), reason: it.reason?.trim() ?? "" }));

		return { taskId: input.taskId, items, summary: raw.summary ?? "" };
	}

	// ─── 7. 회의록 요약 (PO-5 확장, 의존: 2) ─────────────────────────────────

	/**
	 * 회의록 원문 + Agent2 분석 결과 → 구조화된 요약 문서.
	 * suggestedTopics는 PO-2 (회의 주제 자동 생성) 입력값으로 활용.
	 *
	 * 예외:
	 *   - minutes 없음 → throw
	 *   - analysis 없음 → 분석 없이 진행 (graceful degradation)
	 */
	async summarizeMinutes(
		input: MinutesSummaryInput,
		openaiApiKey: string,
	): Promise<MinutesSummaryResult> {
		if (!openaiApiKey.trim()) {
			throw new Error(
				"OpenAI API 키가 설정되지 않았습니다. Pharos 설정에서 API 키를 입력해주세요.",
			);
		}

		const meeting = await this.meetingsService.getById(input.meetingId);
		if (!meeting) {
			throw new Error(`회의 ${input.meetingId}를 찾을 수 없습니다.`);
		}
		if (!meeting.minutes) {
			throw new Error("회의록이 작성되지 않았습니다. 먼저 회의록을 작성해주세요.");
		}

		const prompt = buildMinutesSummaryPrompt(meeting);
		const openai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });

		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{ role: "system", content: MINUTES_SUMMARY_SYSTEM_PROMPT },
				{ role: "user", content: prompt },
			],
			response_format: { type: "json_object" },
			temperature: 0.3,
		});

		const content = response.choices[0]?.message?.content ?? "{}";
		type RawSummary = {
			executiveSummary?: string;
			keyPoints?: string[];
			decisions?: string[];
			actionItems?: { assignee?: string; task?: string }[];
			suggestedTopics?: string[];
		};
		let raw: RawSummary = {};
		try {
			raw = JSON.parse(content) as RawSummary;
		} catch {
			// JSON 파싱 실패 시 빈 결과로 처리
		}

		const actionItems: MinutesSummaryActionItem[] = (raw.actionItems ?? [])
			.filter((it) => it.task?.trim())
			.map((it) => ({
				assignee: it.assignee?.trim() || "팀 전체",
				task: it.task!.trim(),
			}));

		return {
			meetingId: input.meetingId,
			executiveSummary: raw.executiveSummary?.trim() ?? "",
			keyPoints: (raw.keyPoints ?? []).filter((s) => s?.trim()),
			decisions: (raw.decisions ?? []).filter((s) => s?.trim()),
			actionItems,
			suggestedTopics: (raw.suggestedTopics ?? []).filter((s) => s?.trim()),
		};
	}
}
