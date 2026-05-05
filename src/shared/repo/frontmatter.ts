/**
 * Markdown frontmatter 파싱·직렬화.
 *
 * 옵시디언 .md 파일의 frontmatter(YAML) 와 본문을 양방향 변환.
 * - 외부 의존성 없이 직접 구현 (gray-matter 미사용)
 * - YAML 처리는 옵시디언이 노출하는 parseYaml/stringifyYaml 활용
 *
 * 사용:
 *   const { meta, body } = parseFrontmatter(rawMd);
 *   const md = stringifyFrontmatter(meta, body);
 */

import { parseYaml, stringifyYaml } from "obsidian";

const FRONTMATTER_FENCE = "---";

export interface ParsedMd<TMeta extends Record<string, unknown>> {
	meta: TMeta;
	body: string;
}

/**
 * raw markdown 텍스트를 frontmatter 메타와 본문으로 분리.
 *
 * frontmatter 없으면 meta = {} 반환. body는 raw 그대로.
 * frontmatter 있으면 첫 fence 이후 두 번째 fence까지를 YAML로 파싱.
 */
export function parseFrontmatter<TMeta extends Record<string, unknown>>(
	raw: string,
): ParsedMd<TMeta> {
	const trimmed = raw.replace(/^﻿/, ""); // BOM 제거

	// frontmatter 시작 fence가 첫 줄이 아니면 frontmatter 없음
	if (!trimmed.startsWith(FRONTMATTER_FENCE)) {
		return { meta: {} as TMeta, body: trimmed };
	}

	// 두 번째 fence 위치 찾기
	const endIdx = trimmed.indexOf(`\n${FRONTMATTER_FENCE}`, FRONTMATTER_FENCE.length);
	if (endIdx === -1) {
		// fence 닫는 게 없음 → frontmatter 없는 것으로 처리
		return { meta: {} as TMeta, body: trimmed };
	}

	const yamlBlock = trimmed
		.slice(FRONTMATTER_FENCE.length, endIdx)
		.replace(/^\n/, ""); // 시작 줄바꿈 제거

	// 본문은 두 번째 fence 다음 줄부터
	const bodyStart = endIdx + 1 + FRONTMATTER_FENCE.length;
	let body = trimmed.slice(bodyStart);
	if (body.startsWith("\n")) body = body.slice(1);

	let meta: TMeta;
	try {
		meta = (parseYaml(yamlBlock) ?? {}) as TMeta;
	} catch (err) {
		console.error("[Pharos] frontmatter YAML 파싱 실패:", err, "\nblock:", yamlBlock);
		meta = {} as TMeta;
	}

	return { meta, body };
}

/**
 * 메타 객체와 본문을 frontmatter .md 텍스트로 직렬화.
 *
 * - meta가 비어있으면 frontmatter 없이 본문만 반환
 * - body는 trim 안 함 (사용자 작성 그대로 보존)
 * - 마지막 줄바꿈은 정규화 (1개로)
 */
export function stringifyFrontmatter<TMeta extends Record<string, unknown>>(
	meta: TMeta,
	body: string = "",
): string {
	const hasMeta = meta && Object.keys(meta).length > 0;
	if (!hasMeta) {
		return body.endsWith("\n") ? body : body + "\n";
	}

	const yamlText = stringifyYaml(meta).trimEnd();
	const bodyNormalized = body.endsWith("\n") ? body : body + "\n";
	return `${FRONTMATTER_FENCE}\n${yamlText}\n${FRONTMATTER_FENCE}\n${bodyNormalized}`;
}

/**
 * meta만 갱신, body는 원본 보존하고 싶을 때 사용.
 *
 * 예: 분석 결과만 frontmatter에 추가, 회의록 본문은 사용자 작성 그대로.
 */
export function patchFrontmatter<TMeta extends Record<string, unknown>>(
	rawMd: string,
	updateMeta: (current: TMeta) => TMeta,
): string {
	const { meta, body } = parseFrontmatter<TMeta>(rawMd);
	const next = updateMeta(meta);
	return stringifyFrontmatter(next, body);
}
