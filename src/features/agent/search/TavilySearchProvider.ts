import type { ISearchProvider, SearchResult } from "./ISearchProvider";

export class TavilySearchProvider implements ISearchProvider {
	constructor(private readonly getApiKey: () => string) {}

	async search(query: string, maxResults = 5): Promise<SearchResult[]> {
		const apiKey = this.getApiKey();
		if (!apiKey.trim()) throw new Error("Tavily API 키가 설정되지 않았습니다.");

		const MAX_ATTEMPTS = 3;
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			try {
				const resp = await fetch("https://api.tavily.com/search", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${apiKey}`,
					},
					body: JSON.stringify({ query, search_depth: "basic", max_results: maxResults }),
				});
				if (!resp.ok) throw new Error(`Tavily HTTP ${resp.status}`);
				const data = (await resp.json()) as { results?: SearchResult[] };
				return data.results ?? [];
			} catch (e) {
				if (attempt === MAX_ATTEMPTS - 1) throw e;
				await new Promise<void>((resolve) => setTimeout(resolve, 5000));
			}
		}
		return [];
	}
}
