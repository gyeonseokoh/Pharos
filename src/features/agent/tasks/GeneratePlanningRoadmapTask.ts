import type { IAgentTask, AgentContext } from "./IAgentTask";
import type { LLMRequest } from "../domain/llmSchema";
import type {
	GeneratePlanningRoadmapInput,
	GeneratePlanningRoadmapResult,
} from "../domain/agentSchema";

const SYSTEM_PROMPT = `당신은 소프트웨어 프로젝트 기획 로드맵을 생성하는 PM 에이전트입니다.
프로젝트 정보를 바탕으로 기획 단계별 Phase와 활동을 생성합니다.

반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "phases": [
    {
      "id": "phase-plan",
      "name": "기획 및 설계",
      "start": "2026-04-01",
      "end": "2026-04-25",
      "color": "#f97316",
      "activities": ["요구사항 분석", "유스케이스 정의", "아키텍처 설계"]
    }
  ],
  "summary": "기획 로드맵 요약 (한국어)"
}

규칙:
- phases는 3~5개. 반드시 "phase-plan"으로 시작하는 id 사용
- 첫 번째 phase id는 반드시 "phase-plan"
- 각 phase는 프로젝트 특성에 맞는 기획 활동으로 구성
- 날짜는 startDate부터 deadline의 60% 시점까지 배분 (나머지는 개발 단계)
- activities는 3~6개
- phase color는 HEX 색상 코드
- 모든 텍스트는 한국어
- 일반적인 기획 단계: 요구사항 분석 → 유스케이스/시나리오 정의 → 아키텍처 설계 → UI/UX 설계 → 기술스택 확정`;

function buildPrompt(input: GeneratePlanningRoadmapInput): string {
	const lines: string[] = [
		"=== 프로젝트 정보 ===",
		`프로젝트명: ${input.projectName}`,
		`설명: ${input.projectDescription || "미입력"}`,
		`시작일: ${input.startDate}`,
		`마감일: ${input.deadline}`,
		`팀원 수: ${input.memberCount}명`,
		"",
		"=== 요청 ===",
		`위 프로젝트의 기획 단계 로드맵을 생성해주세요.`,
		`시작일(${input.startDate})부터 마감일(${input.deadline}) 약 60% 시점까지의 기획 기간으로 구성하세요.`,
	];
	return lines.join("\n");
}

export class GeneratePlanningRoadmapTask
	implements IAgentTask<GeneratePlanningRoadmapInput, GeneratePlanningRoadmapResult>
{
	async buildRequest(
		input: GeneratePlanningRoadmapInput,
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
		_input: GeneratePlanningRoadmapInput,
	): GeneratePlanningRoadmapResult {
		type RawResult = {
			phases?: Array<{
				id?: string;
				name?: string;
				start?: string;
				end?: string;
				color?: string;
				activities?: string[];
			}>;
			summary?: string;
		};

		let parsed: RawResult = {};
		try {
			parsed = JSON.parse(raw) as RawResult;
		} catch {
			console.warn("[Pharos Agent] GeneratePlanningRoadmapTask JSON parse failed");
		}

		const phases = (parsed.phases ?? [])
			.filter((p) => p.id && p.name && p.start && p.end)
			.map((p) => ({
				id: p.id!,
				name: p.name!,
				start: p.start!,
				end: p.end!,
				color: p.color ?? "#f97316",
				activities: p.activities ?? [],
			}));

		return { phases, summary: parsed.summary ?? "" };
	}
}
