/**
 * LLM 추상화 계층 공통 타입.
 * ILLMProvider 구현체(OpenAI, Anthropic 등)가 공유하는 계약.
 */

export interface LLMMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface LLMRequest {
	messages: LLMMessage[];
	jsonMode?: boolean;
	temperature?: number;
	maxTokens?: number;
	/** buildRequest → parseResponse 사이 task-specific 준비 데이터 전달용. */
	metadata?: unknown;
}

export interface LLMResponse {
	content: string;
	model: string;
}
