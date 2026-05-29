import type { LLMRequest, LLMResponse } from "../domain/llmSchema";

export interface ILLMProvider {
	readonly id: string;
	complete(request: LLMRequest): Promise<LLMResponse>;
}
