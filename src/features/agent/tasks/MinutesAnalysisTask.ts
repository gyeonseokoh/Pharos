import type { IAgentTask, AgentContext } from "./IAgentTask";
import type { LLMRequest } from "../domain/llmSchema";
import type { MinutesAnalysisInput, MinutesAnalysisResult } from "../domain/agentSchema";

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

export class MinutesAnalysisTask
	implements IAgentTask<MinutesAnalysisInput, MinutesAnalysisResult>
{
	async buildRequest(
		input: MinutesAnalysisInput,
		ctx: AgentContext,
	): Promise<LLMRequest> {
		if (input.minutesText.trim().length < 50) {
			throw new Error("회의록 내용이 부족합니다. 최소 50자 이상 입력해주세요.");
		}

		const meeting = await ctx.meetingsService.getById(input.meetingId);
		if (!meeting) {
			throw new Error(`회의 ${input.meetingId}를 찾을 수 없습니다`);
		}

		return {
			messages: [{ role: "user", content: buildMinutesPrompt(input.minutesText) }],
			jsonMode: true,
			temperature: 0.3,
		};
	}

	parseResponse(raw: string, _request: LLMRequest, input: MinutesAnalysisInput): MinutesAnalysisResult {
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
			console.warn("[Pharos Agent] MinutesAnalysisTask JSON parse failed");
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
}
