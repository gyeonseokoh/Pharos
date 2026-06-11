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
		private readonly getModel: string | (() => string) = "gemini-2.0-flash",
	) {
		const modelId = typeof getModel === "function" ? getModel() : getModel;
		this.id = `gemini/${modelId}`;
	}

	private get model(): string {
		return typeof this.getModel === "function" ? this.getModel() : this.getModel;
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

		// 일시적 과부하 / 네트워크 오류 대응 — 지수 백오프로 최대 4회 재시도.
		// 503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED, 5xx, fetch 네트워크 에러를
		// retryable 로 분류. 4xx (인증·요청 형식) 는 즉시 throw.
		const MAX_ATTEMPTS = 4;
		const baseDelayMs = 1500;

		const isRetryable = (err: unknown): boolean => {
			const msg = (err as Error)?.message ?? "";
			if (/\b(503|502|500|504|UNAVAILABLE|RESOURCE_EXHAUSTED|429)\b/.test(msg)) {
				return true;
			}
			if (/(network|fetch failed|ECONNRESET|ETIMEDOUT|timeout)/i.test(msg)) {
				return true;
			}
			return false;
		};

		let lastErr: unknown = null;
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			try {
				const response = await client.models.generateContent({
					model: this.model,
					contents,
					config: {
						temperature: request.temperature ?? 0.3,
						maxOutputTokens: request.maxTokens ?? 2048,
						...(request.jsonMode
							? { responseMimeType: "application/json" }
							: {}),
						...(systemText ? { systemInstruction: systemText } : {}),
					},
				});
				const content = response.text ?? "";
				return { content, model: this.model };
			} catch (err) {
				lastErr = err;
				if (!isRetryable(err) || attempt === MAX_ATTEMPTS - 1) break;
				// 지수 백오프 + 작은 jitter
				const delay =
					baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
				await new Promise<void>((r) => setTimeout(r, delay));
			}
		}

		const msg = (lastErr as Error)?.message ?? "알 수 없는 오류";
		const friendly = /\b(503|UNAVAILABLE)\b/.test(msg)
			? "Gemini 가 일시적으로 과부하 상태입니다 (503). 잠시 후 다시 시도하거나 모델을 gemini-2.0-flash 로 바꿔주세요."
			: /\b(429|RESOURCE_EXHAUSTED)\b/.test(msg)
				? "Gemini 무료 티어 일일/분당 할당량 초과 (429). 다른 API 키로 교체하거나 모델을 변경해주세요."
				: msg;
		throw new Error(friendly);
	}
}