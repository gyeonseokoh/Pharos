export interface SearchResult {
	title: string;
	url: string;
	content: string;
	score: number;
}

export interface ISearchProvider {
	search(query: string, maxResults?: number): Promise<SearchResult[]>;
}
