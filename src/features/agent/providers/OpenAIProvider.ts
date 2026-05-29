import OpenAI from "openai";
import type { ILLMProvider } from "./ILLMProvider";
import type { LLMRequest, LLMResponse } from "../domain/llmSchema";

export class OpenAIProvider implements ILLMProvider {
	readonly id: string;

	constructor(
		private readonly getApiKey: () => string,
		private readonly model = "gpt-4o-mini",
	) {
		this.id = `openai/${model}`;
	}

	async complete(request: LLMRequest): Promise<LLMResponse> {
		const apiKey = this.getApiKey();
		if (!apiKey.trim()) throw new Error("OpenAI API 키가 설정되지 않았습니다.");

		const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

		const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
			model: this.model,
			messages: request.messages,
			temperature: request.temperature ?? 0.3,
		};
		if (request.jsonMode) {
			params.response_format = { type: "json_object" };
		}
		if (request.maxTokens !== undefined) {
			params.max_tokens = request.maxTokens;
		}

		const response = await client.chat.completions.create(params);
		const content = response.choices[0]?.message?.content ?? "";
		return { content, model: response.model };
	}
}
