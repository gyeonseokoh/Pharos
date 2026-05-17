/**
 * AgentService — AI 에이전트 기능 Facade.
 *
 * 다른 Feature Service를 조합하여 OpenAI / Tavily에 필요한 컨텍스트를 구성하고
 * 구조화된 결과를 반환한다.
 *
 * 현재 구현된 기능:
 *   - collectResources: Feature 4 — 회의 자료 수집 (PO-3)
 *
 * PO-3 시나리오 예외 처리:
 *   - 3a. LLM 쿼리 생성 실패 → 주제명 그대로 대체 검색
 *   - 5a. Tavily API 실패 → 5초 대기 후 최대 3회 재시도
 *   - 5b. 검색 결과 없음 → 주제명으로 대체 검색
 *   - 6a. LLM 요약 실패 → 원문 앞 500자 사용
 */

import OpenAI from "openai";
import type { MeetingsService } from "features/meeting/services/meetingsService";
import type {
	CollectedResource,
	ResourceCollectionInput,
	ResourceCollectionResult,
} from "../domain/agentSchema";

// ─── Tavily 내부 타입 ───

interface TavilySearchResult {
	title: string;
	url: string;
	content: string;
	score: number;
}

// ─── 헬퍼 함수 ───

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
				body: JSON.stringify({
					query,
					search_depth: "basic",
					max_results: maxResults,
				}),
			});

			if (!resp.ok) throw new Error(`Tavily HTTP ${resp.status}`);

			const data = (await resp.json()) as { results?: TavilySearchResult[] };
			return data.results ?? [];
		} catch (e) {
			if (attempt === MAX_ATTEMPTS - 1) throw e;
			// 5초 대기 후 재시도 (시나리오 5a)
			await new Promise<void>((resolve) => setTimeout(resolve, 5000));
		}
	}

	return [];
}

/**
 * 주제별 검색 쿼리 2개를 OpenAI로 생성.
 * 실패 시 주제명을 그대로 반환 (시나리오 3a).
 */
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
		// 시나리오 3a: 쿼리 생성 실패 → 주제명 대체
		return queries.length > 0 ? queries : [topic.title];
	} catch {
		return [topic.title]; // 시나리오 3a fallback
	}
}

/**
 * 웹 자료 내용을 OpenAI로 한국어 요약 (3~5문장).
 * 실패 시 원문 앞 500자 반환 (시나리오 6a).
 */
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
		return content.slice(0, 500); // 시나리오 6a fallback
	}
}

// ─── AgentService ───

export class AgentService {
	constructor(private readonly meetingsService: MeetingsService) {}

	/**
	 * Feature 4: 회의 자료 수집 (PO-3).
	 *
	 * 확정된 주제별로 검색 쿼리를 생성하고 Tavily로 웹 자료를 수집,
	 * OpenAI로 요약하여 반환한다. 저장은 호출 측(UI)이 담당.
	 *
	 * @param openaiApiKey - 쿼리 생성·요약용 OpenAI API 키
	 * @param tavilyApiKey - 웹 검색용 Tavily API 키
	 */
	async collectResources(
		input: ResourceCollectionInput,
		openaiApiKey: string,
		tavilyApiKey: string,
	): Promise<ResourceCollectionResult> {
		if (!tavilyApiKey) throw new Error("Tavily API 키가 설정되지 않았습니다");

		const { meetingId, maxResultsPerQuery = 5 } = input;

		// 1. 주제 목록 결정 — 직접 전달되지 않으면 회의에서 조회
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
				// 2. 주제별 검색 쿼리 생성 (2개)
				const queries = await generateSearchQueries(topic, openai);

				// 3. 쿼리별 Tavily 검색
				const seenUrls = new Set<string>(); // 같은 주제 내 URL 중복 제거

				for (const query of queries) {
					let results: TavilySearchResult[];

					try {
						results = await callTavily(query, tavilyApiKey, maxResultsPerQuery);
					} catch {
						// 시나리오 5a: 3회 재시도 모두 실패 → 이 쿼리 건너뜀
						continue;
					}

					// 시나리오 5b: 결과 없으면 주제명으로 대체 검색
					if (results.length === 0 && query !== topic.title) {
						try {
							results = await callTavily(topic.title, tavilyApiKey, maxResultsPerQuery);
						} catch {
							continue;
						}
					}

					// 4. 각 자료 요약
					for (const item of results) {
						if (seenUrls.has(item.url)) continue;
						seenUrls.add(item.url);

						const summary = await summarizeContent(item.title, item.content, openai);
						resources.push({
							topicId: topic.id,
							title: item.title,
							summary,
							sourceUrl: item.url,
						});
					}
				}
			} catch {
				// 주제 단위로 복구 불가한 오류 → failedTopics에 기록
				failedTopics.push(topic.id);
			}
		}

		return {
			meetingId,
			resources,
			totalCollected: resources.length,
			failedTopics,
		};
	}
}
