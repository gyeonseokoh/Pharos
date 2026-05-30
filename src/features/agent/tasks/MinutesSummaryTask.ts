import type { IAgentTask, AgentContext } from "./IAgentTask";
import type { LLMRequest } from "../domain/llmSchema";
import type {
	MinutesSummaryInput,
	MinutesSummaryResult,
	MinutesSummaryActionItem,
} from "../domain/agentSchema";
import type { Meeting } from "../../meeting/domain/meetingSchema";

const SYSTEM_PROMPT = `당신은 회의록을 분석하여 구조화된 요약을 생성하는 PM 어시스턴트입니다.

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

function buildPrompt(meeting: Meeting): string {
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

export class MinutesSummaryTask
	implements IAgentTask<MinutesSummaryInput, MinutesSummaryResult>
{
	async buildRequest(
		input: MinutesSummaryInput,
		ctx: AgentContext,
	): Promise<LLMRequest> {
		const meeting = await ctx.meetingsService.getById(input.meetingId);
		if (!meeting) {
			throw new Error(`회의 ${input.meetingId}를 찾을 수 없습니다.`);
		}
		if (!meeting.minutes) {
			throw new Error("회의록이 작성되지 않았습니다. 먼저 회의록을 작성해주세요.");
		}

		return {
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: buildPrompt(meeting) },
			],
			jsonMode: true,
			temperature: 0.3,
		};
	}

	parseResponse(raw: string, _request: LLMRequest, input: MinutesSummaryInput): MinutesSummaryResult {
		type RawSummary = {
			executiveSummary?: string;
			keyPoints?: string[];
			decisions?: string[];
			actionItems?: { assignee?: string; task?: string }[];
			suggestedTopics?: string[];
		};

		let parsed: RawSummary = {};
		try {
			parsed = JSON.parse(raw) as RawSummary;
		} catch {
			console.warn("[Pharos Agent] MinutesSummaryTask JSON parse failed");
		}

		const actionItems: MinutesSummaryActionItem[] = (parsed.actionItems ?? [])
			.filter((it) => it.task?.trim())
			.map((it) => ({
				assignee: it.assignee?.trim() || "팀 전체",
				task: it.task!.trim(),
			}));

		return {
			meetingId: input.meetingId,
			executiveSummary: parsed.executiveSummary?.trim() ?? "",
			keyPoints: (parsed.keyPoints ?? []).filter((s) => s?.trim()),
			decisions: (parsed.decisions ?? []).filter((s) => s?.trim()),
			actionItems,
			suggestedTopics: (parsed.suggestedTopics ?? []).filter((s) => s?.trim()),
		};
	}
}
