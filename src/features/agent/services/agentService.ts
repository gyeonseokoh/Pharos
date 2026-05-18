/**
 * AgentService — AI 에이전트 비즈니스 로직 Facade.
 *
 * 다른 Feature의 Service를 주입받아 데이터를 수집·가공한 뒤
 * OpenAI API를 호출하고 결과를 파싱하여 반환한다.
 * Repository를 직접 쓰지 않음 — 항상 Service 레이어를 통해 데이터 접근.
 *
 * 에이전트 기능 목록:
 *   1. coordinateSchedule  — 일정 조율        (feat/Agent1)
 *   2. generateMinutes     — 회의록 생성       (feat/Agent2, 의존: 1)
 *   3. analyzeProgress     — 진행 상황 분석    (feat/Agent3, 의존: 2)
 *   4. researchTopics      — 자료 조사         (feat/Agent4, 의존: 2)
 *   5. organizeMaterials   — 자료 정리         (feat/Agent5)
 *   6. breakdownTask       — 업무 세분화·할당  (feat/Agent6 — 현재)
 *   7. summarizeMinutes    — 회의록 요약       (예정, 의존: 2)
 *
 * 사용:
 *   // UI 컴포넌트에서
 *   const result = await plugin.agentService.breakdownTask(
 *     { taskId: "TASK-001", taskTitle: "로그인 API 구현" },
 *     plugin.settings.openaiApiKey,
 *   );
 */

import OpenAI from "openai";
import type {
	ChecklistSuggestion,
	TaskBreakdownInput,
	TaskBreakdownResult,
} from "../domain/agentSchema";

// ─── 상수 ────────────────────────────────────────────────────────────────────

/** 업무 세분화 AI 시스템 프롬프트. */
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

// ─── Service ─────────────────────────────────────────────────────────────────

export class AgentService {
	/**
	 * 업무 세분화 에이전트. (에이전트 기능 6번 — PO-11)
	 *
	 * 흐름:
	 *   1. API 키 검증
	 *   2. Task 정보로 프롬프트 구성
	 *   3. OpenAI GPT-4o-mini 호출
	 *   4. JSON 파싱 + 빈 항목 제거 → 반환
	 *
	 * @param input  Task ID·제목·설명·기술스택
	 * @param openaiApiKey  plugin.settings.openaiApiKey 를 UI에서 전달
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

		// Obsidian은 Electron renderer 환경이므로 dangerouslyAllowBrowser 필요
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
		type RawResponse = {
			items?: { text: string; reason: string }[];
			summary?: string;
		};
		let raw: RawResponse = {};
		try {
			raw = JSON.parse(content) as RawResponse;
		} catch {
			// AI가 유효하지 않은 JSON을 반환한 경우 빈 결과로 처리
		}

		const items: ChecklistSuggestion[] = (raw.items ?? [])
			.filter((it) => it.text?.trim())
			.map((it) => ({ text: it.text.trim(), reason: it.reason?.trim() ?? "" }));

		return {
			taskId: input.taskId,
			items,
			summary: raw.summary ?? "",
		};
	}
}

// ─── 프롬프트 빌더 ───────────────────────────────────────────────────────────

/** 업무 세분화 OpenAI user 프롬프트 구성. */
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
