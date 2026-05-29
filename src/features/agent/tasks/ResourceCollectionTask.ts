/**
 * ResourceCollectionTask — 자료 조사 (PO-3).
 * 복잡한 멀티스텝 파이프라인을 내부에서 처리하는 bypass task.
 *
 * buildRequest에서 모든 작업(검색 + 요약)을 수행하고 { messages: [] }를 반환.
 * AgentExecutor가 빈 messages를 감지해 provider.complete를 건너뜀.
 * parseResponse는 request.metadata에 저장된 결과를 반환 — 인스턴스 상태 없음.
 */

import type { IAgentTask, AgentContext } from "./IAgentTask";
import type { LLMRequest } from "../domain/llmSchema";
import type { ILLMProvider } from "../providers/ILLMProvider";
import type { ISearchProvider } from "../search/ISearchProvider";
import type {
	ResourceCollectionInput,
	ResourceCollectionResult,
	CollectedResource,
} from "../domain/agentSchema";

export class ResourceCollectionTask
	implements IAgentTask<ResourceCollectionInput, ResourceCollectionResult>
{
	constructor(
		private readonly searchProvider: ISearchProvider,
		private readonly llmProvider: ILLMProvider,
	) {}

	async buildRequest(
		input: ResourceCollectionInput,
		ctx: AgentContext,
	): Promise<LLMRequest> {
		const result = await this.runFullPipeline(input, ctx);
		return { messages: [], metadata: result };
	}

	parseResponse(
		_raw: string,
		request: LLMRequest,
	): ResourceCollectionResult {
		return request.metadata as ResourceCollectionResult;
	}

	private async runFullPipeline(
		input: ResourceCollectionInput,
		ctx: AgentContext,
	): Promise<ResourceCollectionResult> {
		const { meetingId, maxResultsPerQuery = 5 } = input;

		let topics = input.topics;
		if (!topics || topics.length === 0) {
			const meeting = await ctx.meetingsService.getById(meetingId);
			if (!meeting) throw new Error(`회의 ${meetingId}를 찾을 수 없습니다`);
			topics = meeting.topics.map((t) => ({
				id: t.id,
				title: t.title,
				description: t.description,
			}));
		}

		const resources: CollectedResource[] = [];
		const failedTopics: string[] = [];

		for (const topic of topics) {
			try {
				const queries = await this.generateSearchQueries(topic);
				const seenUrls = new Set<string>();

				for (const query of queries) {
					let results;
					try {
						results = await this.searchProvider.search(query, maxResultsPerQuery);
					} catch {
						continue;
					}

					if (results.length === 0 && query !== topic.title) {
						try {
							results = await this.searchProvider.search(topic.title, maxResultsPerQuery);
						} catch {
							continue;
						}
					}

					for (const item of results) {
						if (seenUrls.has(item.url)) continue;
						seenUrls.add(item.url);
						const summary = await this.summarizeContent(item.title, item.content);
						resources.push({ topicId: topic.id, title: item.title, summary, sourceUrl: item.url });
					}
				}
			} catch {
				failedTopics.push(topic.id);
			}
		}

		return { meetingId, resources, totalCollected: resources.length, failedTopics };
	}

	private async generateSearchQueries(
		topic: { title: string; description?: string },
	): Promise<string[]> {
		const content = [
			`회의 주제: ${topic.title}`,
			topic.description ? `주제 설명: ${topic.description}` : "",
			"",
			"위 주제에 관한 웹 검색 쿼리를 2개 생성해주세요.",
			'반드시 유효한 JSON만 반환하세요: { "queries": ["쿼리1", "쿼리2"] }',
		]
			.filter(Boolean)
			.join("\n");

		try {
			const resp = await this.llmProvider.complete({
				messages: [{ role: "user", content }],
				jsonMode: true,
				temperature: 0.3,
			});
			const parsed = JSON.parse(resp.content) as { queries?: string[] };
			const queries = (parsed.queries ?? []).filter(Boolean);
			return queries.length > 0 ? queries : [topic.title];
		} catch {
			return [topic.title];
		}
	}

	private async summarizeContent(title: string, content: string): Promise<string> {
		try {
			const prompt = [
				"아래 웹 자료를 3~5문장으로 한국어 요약하세요.",
				`제목: ${title}`,
				`내용: ${content.slice(0, 2000)}`,
			].join("\n");

			const resp = await this.llmProvider.complete({
				messages: [{ role: "user", content: prompt }],
				temperature: 0.3,
				maxTokens: 300,
			});
			return resp.content.trim() || content.slice(0, 500);
		} catch {
			return content.slice(0, 500);
		}
	}
}
