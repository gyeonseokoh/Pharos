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
		lines.push("", "=== 회의록 ===");
		for (const m of input.meetingSummaries) {
			lines.push(`[${m.date}] ${m.title}`);
			if (m.summary) {
				lines.push(`  요약: ${m.summary}`);
			}
			if (m.decisions.length > 0) {
				lines.push(`  결정사항: ${m.decisions.slice(0, 5).join(" / ")}`);
			}
			if (m.keywords.length > 0) {
				lines.push(`  키워드: ${m.keywords.slice(0, 8).join(", ")}`);
			}
			if (m.techStacks && m.techStacks.length > 0) {
				lines.push(`  기술스택: ${m.techStacks.slice(0, 8).join(", ")}`);
			}
			if (
				m.contentSnippet &&
				m.decisions.length === 0 &&
				m.keywords.length === 0
			) {
				lines.push(`  본문 발췌:`);
				lines.push(m.contentSnippet.split("\n").map((l) => `    ${l}`).join("\n"));
			}
		}
	} else {
		lines.push(
			"",
			"=== 회의록 ===",
			"(회의록이 아직 없습니다. 프로젝트명·설명·팀원 정보만으로 합리적인 기본 개발 로드맵을 생성하세요.)",
		);
	}

	lines.push(
		"",
		"=== 요청 ===",
		`기획 완료일(${input.planningEndIso}) 다음날부터 마감일(${input.deadline})까지의 개발 로드맵을 생성해주세요.`,
		"회의록 결정사항·키워드·요약·본문 발췌를 종합해 구체적인 Task 를 만들어주세요.",
		"회의록이 부족하면 프로젝트 설명·팀원 기술스택을 바탕으로 일반적인 소프트웨어 개발 흐름(요구사항 정리 → 설계 → 핵심 기능 구현 → 통합 테스트 → 배포 준비)에 맞춰 추정해 주세요.",
		"",
		"중요: phases 는 반드시 최소 2개 이상, tasks 는 최소 5개 이상 생성. 빈 배열 반환 금지.",
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
		let parseError = "";
		try {
			// Gemini 가 ```json ... ``` 코드 펜스로 감쌀 때 대비 한 번 더 정제
			const cleaned = raw
				.trim()
				.replace(/^```(?:json)?\s*/i, "")
				.replace(/\s*```$/, "")
				.trim();
			parsed = JSON.parse(cleaned) as RawResult;
		} catch (e) {
			parseError = (e as Error).message;
			console.warn(
				"[Pharos Agent] GenerateDevRoadmapTask JSON parse failed. Raw response:",
				raw,
			);
		}

		console.debug(
			"[Pharos Agent] GenerateDevRoadmapTask parsed:",
			"phases:",
			parsed.phases?.length ?? 0,
			"tasks:",
			parsed.tasks?.length ?? 0,
		);

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

		// 실패 시 진단 정보를 throw 메시지에 박아 모달 UI 에 그대로 노출.
		// (콘솔 못 보는 환경에서도 사용자가 원인을 바로 확인 가능)
		if (phases.length === 0) {
			const rawPhases = parsed.phases ?? [];
			const rawTasks = parsed.tasks ?? [];
			const head = raw.slice(0, 400);
			const details = parseError
				? `JSON 파싱 실패: ${parseError}\n응답 앞부분:\n${head}`
				: rawPhases.length === 0
					? `AI 응답에 phases 가 0개. 응답 앞부분:\n${head}`
					: `AI 가 phases ${rawPhases.length}개·tasks ${rawTasks.length}개 반환했지만 모두 필수 필드(id/name/start/end) 누락으로 필터링됨. 첫 phase 샘플:\n${JSON.stringify(rawPhases[0])}`;
			throw new Error(`AI 가 유효한 로드맵을 생성하지 못했습니다.\n\n[진단]\n${details}`);
		}

		return { phases, tasks, summary: parsed.summary ?? "" };
	}
}
