import type { IAgentTask, AgentContext } from "./IAgentTask";
import type { LLMRequest } from "../domain/llmSchema";
import type {
	TaskBreakdownInput,
	TaskBreakdownResult,
	ChecklistSuggestion,
} from "../domain/agentSchema";

const SYSTEM_PROMPT = `당신은 소프트웨어 개발 업무 세분화 전문 AI 에이전트입니다.
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

function buildPrompt(input: TaskBreakdownInput): string {
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

export class TaskBreakdownTask
	implements IAgentTask<TaskBreakdownInput, TaskBreakdownResult>
{
	async buildRequest(input: TaskBreakdownInput, _ctx: AgentContext): Promise<LLMRequest> {
		return {
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: buildPrompt(input) },
			],
			jsonMode: true,
			temperature: 0.4,
		};
	}

	parseResponse(raw: string, _request: LLMRequest, input: TaskBreakdownInput): TaskBreakdownResult {
		type RawBreakdown = { items?: { text: string; reason: string }[]; summary?: string };
		let parsed: RawBreakdown = {};
		try {
			parsed = JSON.parse(raw) as RawBreakdown;
		} catch {
			console.warn("[Pharos Agent] TaskBreakdownTask JSON parse failed");
		}

		const items: ChecklistSuggestion[] = (parsed.items ?? [])
			.filter((it) => it.text?.trim())
			.map((it) => ({ text: it.text.trim(), reason: it.reason?.trim() ?? "" }));

		return { taskId: input.taskId, items, summary: parsed.summary ?? "" };
	}
}
