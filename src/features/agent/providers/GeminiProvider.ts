/**
 * Google Gemini provider — @google/genai SDK 사용 (2025년 5월 GA, 공식 권장).
 *
 * @google/generative-ai 는 2025년 8월 EoL로 deprecated.
 * 현재 Google 공식 권장: @google/genai (googleapis/js-genai)
 *
 * 참고: https://ai.google.dev/gemini-api/docs/libraries
 */

import { GoogleGenAI } from "@google/genai";
import type { ILLMProvider } from "./ILLMProvider";
import type { LLMRequest, LLMResponse } from "../domain/llmSchema";

export class GeminiProvider implements ILLMProvider {
	readonly id: string;

	constructor(
		private readonly getApiKey: () => string,
		private readonly model = "gemini-2.0-flash",
	) {
		this.id = `gemini/${model}`;
	}

	async complete(request: LLMRequest): Promise<LLMResponse> {
		const apiKey = this.getApiKey();
		if (!apiKey.trim()) throw new Error("Gemini API 키가 설정되지 않았습니다.");

		const client = new GoogleGenAI({ apiKey });

		// system role 분리 — Gemini는 systemInstruction으로 별도 전달
		const systemMessages = request.messages.filter((m) => m.role === "system");
		const conversationMessages = request.messages.filter((m) => m.role !== "system");

		let systemText = systemMessages.map((m) => m.content).join("\n");
		if (request.jsonMode) {
			systemText +=
				(systemText ? "\n" : "") +
				"반드시 유효한 JSON만 반환하세요. 마크다운 코드 블럭이나 설명 텍스트 없이 순수 JSON만 출력하세요.";
		}

		// Gemini는 user/model 교대 구조를 요구하며 user로 시작해야 함.
		// system 제거 후 남은 메시지가 없으면 빈 user 메시지를 삽입.
		const contents =
			conversationMessages.length > 0
				? conversationMessages.map((m) => ({
						role: m.role === "assistant" ? "model" : "user",
						parts: [{ text: m.content }],
					}))
				: [{ role: "user" as const, parts: [{ text: "(no input)" }] }];

		const response = await client.models.generateContent({
			model: this.model,
			contents,
			config: {
				temperature: request.temperature ?? 0.3,
				maxOutputTokens: request.maxTokens ?? 2048,
				...(request.jsonMode ? { responseMimeType: "application/json" } : {}),
				...(systemText ? { systemInstruction: systemText } : {}),
			},
		});

		const content = response.text ?? "";
		return { content, model: this.model };
	}
}