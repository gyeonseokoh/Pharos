/**
 * AgentService — AI 에이전트 기능 Facade.
 *
 * 다른 Feature Service를 조합하여 OpenAI에 필요한 컨텍스트를 구성하고
 * 구조화된 결과를 반환한다.
 *
 * 현재 구현된 기능:
 *   - analyzeMinutes: Feature 2 — 회의록 분석 (PO-5)
 *
 * PO-5 시나리오 예외 처리:
 *   - 2a. 텍스트 50자 미만 → throw (UI에서 안내 메시지 표시)
 *   - 5a. 키워드 추출 실패 → 빈도 기반 fallback으로 보완
 *   - JSON 파싱 실패 → 빈 객체 fallback (R1 취약점 수정)
 */

import OpenAI from "openai";
import type { MeetingsService } from "features/meeting/services/meetingsService";
import type { MinutesAnalysisInput, MinutesAnalysisResult } from "../domain/agentSchema";

// ─── 프롬프트 빌더 ───

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

// ─── 헬퍼 ───

/** 키워드 보완용 불용어. */
const STOPWORDS = new Set([
	"그리고", "그러나", "하지만", "이것", "저것", "우리", "회의", "내용",
	"관련", "진행", "논의", "있다", "없다", "한다", "된다", "이다",
	"있는", "그", "것", "수", "및", "등", "를", "을", "이", "가",
]);

/**
 * PO-5-BR-2 fallback: AI 키워드가 3개 미만이면 빈도 기반으로 보완 (시나리오 5a).
 */
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

// ─── AgentService ───

export class AgentService {
	constructor(private readonly meetingsService: MeetingsService) {}

	/**
	 * Feature 2: 회의록 분석 (PO-5).
	 *
	 * 회의록 텍스트를 OpenAI로 분석하여 키워드·기술스택·결정사항·요약을 추출한다.
	 * 저장은 호출 측(MeetingsService.attachMinutes)이 담당.
	 */
	async analyzeMinutes(
		input: MinutesAnalysisInput,
		openaiApiKey: string,
	): Promise<MinutesAnalysisResult> {
		// 1. 입력 검증
		if (!openaiApiKey) throw new Error("OpenAI API 키가 설정되지 않았습니다");
		// PO-5 시나리오 2a: 텍스트 최소 50자
		if (input.minutesText.trim().length < 50) {
			throw new Error("회의록 내용이 부족합니다. 최소 50자 이상 입력해주세요.");
		}

		// 2. 회의 존재 확인
		const meeting = await this.meetingsService.getById(input.meetingId);
		if (!meeting) {
			throw new Error(`회의 ${input.meetingId}를 찾을 수 없습니다`);
		}

		// 3. OpenAI 호출
		const openai = new OpenAI({
			apiKey: openaiApiKey,
			dangerouslyAllowBrowser: true,
		});
		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: buildMinutesPrompt(input.minutesText) }],
			response_format: { type: "json_object" },
			temperature: 0.3,
		});

		// 4. JSON 파싱 (실패 시 빈 객체 fallback — R1 취약점 수정)
		const raw = completion.choices[0]?.message?.content ?? "{}";
		type ParsedResponse = {
			keywords?: string[];
			techStacks?: string[];
			decisions?: string[];
			summary?: string;
		};
		let parsed: ParsedResponse = {};
		try {
			parsed = JSON.parse(raw) as ParsedResponse;
		} catch {
			// AI가 유효하지 않은 JSON을 반환한 경우 빈 객체로 fallback
			// 이후 ?? 기본값·supplementKeywords 처리로 안전하게 처리됨
		}

		// 5. 결과 정제
		const rawKeywords = (parsed.keywords ?? []).filter(Boolean);
		// PO-5-BR-2: 최소 3개 보장 (시나리오 5a fallback)
		const keywords = supplementKeywords(input.minutesText, rawKeywords);

		return {
			meetingId: input.meetingId,
			keywords,
			techStacks: (parsed.techStacks ?? []).filter(Boolean),
			decisions: (parsed.decisions ?? []).filter(Boolean),
			summary: parsed.summary ?? "",
		};
	}
}
