/**
 * Topic Page 목업: 기존 meetingPageMocks에서 특정 주제를 뽑아 Topic 뷰 형태로 재구성.
 */

import { meetingPageMocks } from "./meetingPageMock";
import type { TopicPageData } from "../domain/topicPageData";

export function getTopicPageMock(
	meetingId: string,
	topicId: string,
): TopicPageData | null {
	const meeting = meetingPageMocks[meetingId];
	if (!meeting) return null;

	const topic = meeting.topics.find((t) => t.id === topicId);
	if (!topic) return null;

	const resources = meeting.resources.filter((r) => r.topicId === topicId);

	// 목업: AI 분석의 결정사항 중 주제 제목이나 키워드 포함하는 것만 필터 (간단한 휴리스틱)
	const decisions = meeting.analysis
		? meeting.analysis.decisions.filter((d) =>
				keywordsMatch(d, topic.title),
			)
		: [];

	// 목업 excerpt: 분석 결과가 있으면 주제 관련 부분 추출 (단순 구현)
	const minutesExcerpt = meeting.analysis
		? extractExcerpt(meeting.minutes?.content ?? null, topic.title)
		: null;

	return {
		meeting: {
			id: meeting.id,
			title: meeting.title,
			date: meeting.date,
			time: meeting.time,
		},
		topic,
		resources,
		decisions,
		minutesExcerpt,
	};
}

function keywordsMatch(text: string, topicTitle: string): boolean {
	// 단순한 키워드 오버랩 검사 (실제론 LLM이 더 잘 매칭할 것)
	const words = topicTitle
		.toLowerCase()
		.split(/[\s·/]+/)
		.filter((w) => w.length >= 2);
	return words.some((w) => text.toLowerCase().includes(w));
}

function extractExcerpt(minutes: string | null, topicTitle: string): string | null {
	if (!minutes) return null;
	const lines = minutes.split("\n");
	const words = topicTitle
		.toLowerCase()
		.split(/[\s·/]+/)
		.filter((w) => w.length >= 2);

	// 주제 키워드 포함한 줄 주변 ±1 줄 발췌
	const matchedIndices = new Set<number>();
	lines.forEach((line, i) => {
		if (words.some((w) => line.toLowerCase().includes(w))) {
			matchedIndices.add(Math.max(0, i - 1));
			matchedIndices.add(i);
			matchedIndices.add(Math.min(lines.length - 1, i + 1));
		}
	});

	if (matchedIndices.size === 0) return null;

	const excerpt = Array.from(matchedIndices)
		.sort((a, b) => a - b)
		.map((i) => lines[i])
		.filter((l): l is string => l !== undefined)
		.join("\n");

	return excerpt.trim() || null;
}
