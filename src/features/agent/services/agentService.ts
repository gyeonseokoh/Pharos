/**
 * AgentService — AI 에이전트 비즈니스 로직 Facade.
 *
 * 다른 Feature의 Service를 주입받아 데이터를 수집·가공한 뒤
 * OpenAI API를 호출하고 결과를 파싱하여 반환한다.
 * Repository를 직접 쓰지 않음 — 항상 Service 레이어를 통해 데이터 접근.
 *
 * 에이전트 기능 목록:
 *   1. coordinateSchedule  — 일정 조율        (feat/Agent1)
 *   2. analyzeMinutes      — 회의록 분석       (feat/Agent2)
 *   3. analyzeProgress     — 진행 상황 분석    (feat/Agent3)
 *   4. collectResources    — 자료 조사         (feat/Agent4)
 *   5. organizeMaterials   — 자료 정리         (예정)
 *   6. breakdownTask       — 업무 세분화·할당  (feat/Agent6)
 *   7. summarizeMinutes    — 회의록 요약       (현재, 의존: 2)
 *
 * 사용:
 *   const result = await plugin.agentService.summarizeMinutes(
 *     { meetingId: "meeting-2026-05-04" },
 *     plugin.settings.openaiApiKey,
 *   );
 */

import OpenAI from "openai";
import type { MeetingsService } from "../../meeting/services/meetingsService";
import type { Meeting } from "../../meeting/domain/meetingSchema";
import type {
	MinutesSummaryActionItem,
	MinutesSummaryInput,
	MinutesSummaryResult,
} from "../domain/agentSchema";

// ─── 상수 ────────────────────────────────────────────────────────────────────

/** 회의록 요약 AI 시스템 프롬프트. */
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
- keyPoints: 3~7개. 회의에서 논의된 주요 포인트 (불릿 형태)
- decisions: "결정", "확정", "합의", "채택" 등 확실한 결정사항만 포함. 없으면 빈 배열
- actionItems: 명확히 누가 무엇을 해야 하는지 알 수 있는 항목만. 담당자 불명확하면 "팀 전체". 없으면 빈 배열
- suggestedTopics: 이번 회의 내용·미결사항·결정사항을 바탕으로 다음 회의에서 다룰 3~5개 주제 추천 (PO-2 입력용)
- % 진척도 표현 금지 ("70% 완료", "절반 정도" 등 추정 비율 표현 사용 금지)
- 모든 텍스트는 한국어로 작성`;

/** 분석에 포함할 회의록 최대 길이(자). 토큰 한계 방지. */
const MAX_MINUTES_LENGTH = 6000;

// ─── Service ─────────────────────────────────────────────────────────────────

export class AgentService {
	constructor(private readonly meetingsService: MeetingsService) {}

	/**
	 * 회의록 요약 에이전트. (에이전트 기능 7번)
	 *
	 * 흐름:
	 *   1. API 키 검증
	 *   2. 회의 조회 — 존재 여부 확인
	 *   3. 회의록(minutes) 존재 여부 확인 (없으면 throw)
	 *   4. 기존 분석(analysis) 있으면 추가 컨텍스트로 활용 (Agent2 의존)
	 *   5. OpenAI GPT-4o-mini 호출
	 *   6. JSON 파싱 + 필터링 → 반환
	 *
	 * 예외:
	 *   - API 키 미설정 → throw
	 *   - 회의 없음 → throw
	 *   - 회의록 미첨부 → throw
	 *   - JSON 파싱 실패 → 빈 배열 fallback (크래시 방지)
	 *
	 * @param input      요약할 회의 ID
	 * @param openaiApiKey  plugin.settings.openaiApiKey 를 UI에서 전달
	 */
	async summarizeMinutes(
		input: MinutesSummaryInput,
		openaiApiKey: string,
	): Promise<MinutesSummaryResult> {
		// 1. API 키 검증
		if (!openaiApiKey.trim()) {
			throw new Error(
				"OpenAI API 키가 설정되지 않았습니다. Pharos 설정에서 API 키를 입력해주세요.",
			);
		}

		// 2. 회의 조회
		const meeting = await this.meetingsService.getById(input.meetingId);
		if (!meeting) {
			throw new Error(`회의 ${input.meetingId}를 찾을 수 없습니다.`);
		}

		// 3. 회의록 존재 확인 (Agent7은 회의록 원문이 필수)
		if (!meeting.minutes) {
			throw new Error(
				"회의록이 작성되지 않았습니다. 먼저 회의록을 작성해주세요.",
			);
		}

		// 4. 프롬프트 구성 (Agent2 분석 결과가 있으면 추가 컨텍스트로 활용)
		const prompt = buildMinutesSummaryPrompt(meeting);

		// 5. OpenAI 호출 (Obsidian = Electron renderer 환경)
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

		// 6. JSON 파싱 (실패 시 빈 결과로 fallback — 크래시 방지)
		const content = response.choices[0]?.message?.content ?? "{}";
		type RawResponse = {
			executiveSummary?: string;
			keyPoints?: string[];
			decisions?: string[];
			actionItems?: { assignee?: string; task?: string }[];
			suggestedTopics?: string[];
		};
		let raw: RawResponse = {};
		try {
			raw = JSON.parse(content) as RawResponse;
		} catch {
			// AI가 유효하지 않은 JSON을 반환한 경우 빈 결과로 처리
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

// ─── 프롬프트 빌더 ───────────────────────────────────────────────────────────

/** 회의록 요약 OpenAI user 프롬프트 구성. */
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

	// 회의록 원문 (토큰 한계 방지: MAX_MINUTES_LENGTH 자 이후 생략)
	const minutesContent = meeting.minutes!.content;
	const truncated = minutesContent.length > MAX_MINUTES_LENGTH;
	lines.push(
		"",
		"=== 회의록 원문 ===",
		truncated ? minutesContent.slice(0, MAX_MINUTES_LENGTH) + "\n...(이하 생략)" : minutesContent,
	);

	// Agent2 분석 결과가 있으면 AI 컨텍스트로 제공 (더 정확한 요약 유도)
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
