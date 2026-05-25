/**
 * Anthropic Claude provider — fetch 직접 사용 (@anthropic-ai/sdk 미설치).
 * JSON 응답이 필요할 때는 system prompt로 지시.
 */

import type { ILLMProvider } from "./ILLMProvider";
import type { LLMRequest, LLMResponse } from "../domain/llmSchema";

interface AnthropicMessage {
	role: "user" | "assistant";
	content: string;
}

interface AnthropicResponseBody {
	id: string;
	model: string;
	content: Array<{ type: string; text: string }>;
}

export class AnthropicProvider implements ILLMProvider {
	readonly id: string;

	constructor(
		private readonly getApiKey: () => string,
		private readonly model = "claude-haiku-4-5-20251001",
	) {
		this.id = `anthropic/${model}`;
	}

	async complete(request: LLMRequest): Promise<LLMResponse> {
		const apiKey = this.getApiKey();
		if (!apiKey.trim()) throw new Error("Anthropic API 키가 설정되지 않았습니다.");

		const systemMessages = request.messages.filter((m) => m.role === "system");
		const conversationMessages = request.messages.filter((m) => m.role !== "system");

		let system = systemMessages.map((m) => m.content).join("\n");
		if (request.jsonMode) {
			system += (system ? "\n" : "") + "반드시 유효한 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.";
		}

		const messages: AnthropicMessage[] = conversationMessages.map((m) => ({
			role: m.role as "user" | "assistant",
			content: m.content,
		}));

		const body: Record<string, unknown> = {
			model: this.model,
			messages,
			max_tokens: request.maxTokens ?? 2048,
		};
		if (system) body.system = system;
		if (request.temperature !== undefined) body.temperature = request.temperature;

		const resp = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
				"anthropic-dangerous-direct-browser-access": "true",
			},
			body: JSON.stringify(body),
		});

		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(`Anthropic API 오류 ${resp.status}: ${text}`);
		}

		const data = (await resp.json()) as AnthropicResponseBody;
		const content = data.content.find((c) => c.type === "text")?.text ?? "";
		return { content, model: data.model };
	}
}
