import type { IAgentTask, AgentContext } from "./IAgentTask";
import type { LLMRequest } from "../domain/llmSchema";
import type {
	GenerateDevRoadmapInput,
	GenerateDevRoadmapResult,
	DevRoadmapPhase,
	DevRoadmapTask,
} from "../domain/agentSchema";

const SYSTEM_PROMPT = `당신은 소프트웨어 프로젝트 개발 로드맵을 생성하는 PM 에이전트입니다.
회의록·팀원 정보를 분석하여 개발 단계(Phase)와 Task 목록을 생성합니다.

반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "phases": [
    {
      "id": "dev-mvp",
      "name": "MVP 개발",
      "start": "2026-05-01",
      "end": "2026-05-20",
      "color": "#6366f1",
      "activities": ["핵심 기능 구현", "단위 테스트"]
    }
  ],
  "tasks": [
    {
      "id": "task-001",
      "name": "로그인 API 구현",
      "start": "2026-05-01",
      "end": "2026-05-05",
      "assignee": "홍길동",
      "phaseId": "dev-mvp",
      "dependsOn": []
    }
  ],
  "summary": "개발 로드맵 요약 (한국어)"
}

규칙:
- phases는 2~5개. id는 "dev-" 접두어 사용
- tasks는 회의록 결정사항·키워드 기반으로 5~15개 생성
- 각 task의 assignee는 팀원 이름 중 기술스택에 맞는 사람으로 배정. 없으면 null
- 날짜는 planningEndIso 다음날부터 deadline 이전까지 배분
- phase color는 HEX 색상 코드
- 모든 텍스트는 한국어`;

function buildPrompt(input: GenerateDevRoadmapInput): string {
	const lines: string[] = [
		"=== 프로젝트 정보 ===",
		`프로젝트명: ${input.projectName}`,
		`설명: ${input.projectDescription}`,
		`마감일: ${input.deadline}`,
		`기획 완료일: ${input.planningEndIso}`,
		"",
		"=== 팀원 ===",
		...input.members.map(
			(m) => `- ${m.name} (${m.role}): ${m.techStacks.join(", ") || "미지정"}`,
		),
	];

	if (input.meetingSummaries.length > 0) {
		lines.push("", "=== 회의록 요약 ===");
		for (const m of input.meetingSummaries) {
			lines.push(`[${m.date}] ${m.title}`);
			if (m.decisions.length > 0) {
				lines.push(`  결정사항: ${m.decisions.slice(0, 3).join(", ")}`);
			}
			if (m.keywords.length > 0) {
				lines.push(`  키워드: ${m.keywords.slice(0, 5).join(", ")}`);
			}
		}
	}

	lines.push(
		"",
		"=== 요청 ===",
		`기획 완료일(${input.planningEndIso}) 다음날부터 마감일(${input.deadline})까지의 개발 로드맵을 생성해주세요.`,
		"회의록 결정사항과 키워드를 기반으로 구체적인 Task를 만들어주세요.",
	);

	return lines.join("\n");
}

export class GenerateDevRoadmapTask
	implements IAgentTask<GenerateDevRoadmapInput, GenerateDevRoadmapResult>
{
	async buildRequest(
		input: GenerateDevRoadmapInput,
		_ctx: AgentContext,
	): Promise<LLMRequest> {
		return {
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: buildPrompt(input) },
			],
			jsonMode: true,
			temperature: 0.4,
		};
	}

	parseResponse(
		raw: string,
		_request: LLMRequest,
		_input: GenerateDevRoadmapInput,
	): GenerateDevRoadmapResult {
		type RawResult = {
			phases?: Partial<DevRoadmapPhase>[];
			tasks?: Partial<DevRoadmapTask>[];
			summary?: string;
		};

		let parsed: RawResult = {};
		try {
			parsed = JSON.parse(raw) as RawResult;
		} catch {
			console.warn("[Pharos Agent] GenerateDevRoadmapTask JSON parse failed");
		}

		const phases: DevRoadmapPhase[] = (parsed.phases ?? [])
			.filter((p) => p.id && p.name && p.start && p.end)
			.map((p) => ({
				id: p.id!,
				name: p.name!,
				start: p.start!,
				end: p.end!,
				color: p.color ?? "#6366f1",
				activities: p.activities ?? [],
			}));

		const tasks: DevRoadmapTask[] = (parsed.tasks ?? [])
			.filter((t) => t.id && t.name && t.start && t.end)
			.map((t) => ({
				id: t.id!,
				name: t.name!,
				start: t.start!,
				end: t.end!,
				assignee: t.assignee ?? null,
				phaseId: t.phaseId ?? (phases[0]?.id ?? "dev-mvp"),
				dependsOn: t.dependsOn ?? [],
			}));

		return { phases, tasks, summary: parsed.summary ?? "" };
	}
}
