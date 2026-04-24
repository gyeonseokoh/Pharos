/**
 * PO-5 회의록 분석 시뮬레이터 (하드코딩).
 *
 * 나중에 LLM/NLP로 교체되지만 인터페이스는 유지.
 *   - extractKeywords: 빈도 기반 상위 N개
 *   - extractTechStacks: 사전 키워드 매칭
 *   - extractDecisions: "결정/확정/합의" 포함 라인
 *   - generateSummary: 첫 문장 또는 템플릿
 *
 * DEV_MINUTES_STEPS 는 UI에서 진행 애니메이션용.
 */

import type { MeetingAnalysis, MeetingCategory } from "../domain/meetingPageData";

export const MINUTES_ANALYSIS_STEPS = [
	{ id: "preprocess", label: "회의록 전처리" },
	{ id: "keywords", label: "핵심 키워드 추출" },
	{ id: "techstack", label: "기술 스택 식별" },
	{ id: "decisions", label: "주요 결정사항 추출" },
	{ id: "classify", label: "회의록 자동 분류" },
	{ id: "save", label: "분석 결과 저장" },
] as const;

/** feature 분류 신호 — UI/기능/요구사항 관련 어휘. */
const FEATURE_SIGNALS = [
	"기능",
	"요구사항",
	"스펙",
	"UI",
	"UX",
	"디자인",
	"레이아웃",
	"화면",
	"페이지",
	"플로우",
	"모달",
	"버튼",
	"뷰",
	"컴포넌트",
	"사용자",
	"인터페이스",
];

/** progress 분류 신호 — 진행상황/Task/일정 관련 어휘. */
const PROGRESS_SIGNALS = [
	"진행",
	"완료",
	"블로커",
	"일정",
	"마감",
	"Task",
	"task",
	"커밋",
	"배포",
	"이슈",
	"딜레이",
	"지연",
	"스프린트",
	"릴리즈",
	"버그",
	"테스트",
	"작업",
];

/** 기술 스택 후보 사전 — 회의록 본문에서 이 단어가 발견되면 반환. */
const TECH_DICTIONARY = [
	"React",
	"Next.js",
	"TypeScript",
	"JavaScript",
	"Node",
	"Node.js",
	"Obsidian",
	"Yjs",
	"Hocuspocus",
	"SQLite",
	"PostgreSQL",
	"MySQL",
	"MongoDB",
	"Redis",
	"Python",
	"FastAPI",
	"Django",
	"Flask",
	"OpenAI",
	"GPT",
	"Tavily",
	"LangChain",
	"Tailwind",
	"shadcn/ui",
	"Oracle Cloud",
	"AWS",
	"Docker",
	"GitHub Actions",
	"Vite",
	"esbuild",
	"Jest",
	"Vitest",
	"Playwright",
];

/** 결정/확정/합의를 나타내는 시그널 단어. */
const DECISION_SIGNALS = [
	"결정",
	"확정",
	"합의",
	"채택",
	"최종",
	"→",
];

/** 불용어 — 키워드 추출 시 제외. */
const STOPWORDS = new Set([
	"그리고",
	"그러나",
	"하지만",
	"이것",
	"저것",
	"우리",
	"회의",
	"내용",
	"관련",
	"진행",
	"논의",
	"부분",
	"정도",
	"때문",
	"경우",
	"통해",
	"대해",
	"위해",
	"있음",
	"없음",
	"있다",
	"없다",
	"한다",
	"된다",
	"이다",
	"있는",
	"있을",
	"된",
	"할",
	"그",
	"것",
	"수",
	"및",
	"등",
]);

function extractKeywords(content: string, topN = 5): string[] {
	const tokens = content
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter((w) => w.length >= 2 && !STOPWORDS.has(w));

	const freq = new Map<string, number>();
	for (const t of tokens) {
		freq.set(t, (freq.get(t) ?? 0) + 1);
	}

	return [...freq.entries()]
		.filter(([, c]) => c >= 2)
		.sort((a, b) => b[1] - a[1])
		.slice(0, topN)
		.map(([w]) => w);
}

function extractTechStacks(content: string): string[] {
	const lower = content.toLowerCase();
	const found = new Set<string>();
	for (const tech of TECH_DICTIONARY) {
		if (lower.includes(tech.toLowerCase())) {
			found.add(tech);
		}
	}
	return [...found];
}

function extractDecisions(content: string): string[] {
	const lines = content
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	const picks: string[] = [];
	for (const line of lines) {
		// 불릿 정리
		const clean = line.replace(/^[-*•]\s*/, "").trim();
		if (clean.length < 4) continue;
		if (DECISION_SIGNALS.some((sig) => clean.includes(sig))) {
			picks.push(clean);
		}
	}

	// 너무 많으면 상위 6개만
	return picks.slice(0, 6);
}

function countSignals(content: string, signals: string[]): number {
	const lower = content.toLowerCase();
	let score = 0;
	for (const s of signals) {
		const needle = s.toLowerCase();
		let idx = 0;
		while ((idx = lower.indexOf(needle, idx)) !== -1) {
			score += 1;
			idx += needle.length;
		}
	}
	return score;
}

/**
 * 회의록 본문 → 카테고리 분류. 다중 분류 허용.
 * 각 카테고리 신호 단어가 임계값(2) 이상 등장하면 해당 카테고리 부여.
 * 빈 배열이면 "기타 회의록" 탭으로 배치.
 */
export function classifyMinute(content: string): MeetingCategory[] {
	const featureScore = countSignals(content, FEATURE_SIGNALS);
	const progressScore = countSignals(content, PROGRESS_SIGNALS);

	const threshold = 2;
	const categories: MeetingCategory[] = [];
	if (featureScore >= threshold) categories.push("feature");
	if (progressScore >= threshold) categories.push("progress");
	return categories;
}

function generateSummary(content: string, keywords: string[]): string {
	const firstSentence = content
		.split(/[.。\n]/)
		.map((s) => s.trim())
		.find((s) => s.length >= 10);

	if (firstSentence) {
		return firstSentence.length > 120
			? firstSentence.slice(0, 120) + "…"
			: firstSentence;
	}
	if (keywords.length > 0) {
		return `주요 주제: ${keywords.join(", ")}.`;
	}
	return "회의 요약 생성 실패 — 본문이 너무 짧습니다.";
}

export interface AnalyzeMinutesInput {
	content: string;
}

/**
 * 회의록 → 분석 결과 생성. pure 함수 (side-effect 없음).
 * 나중에 실제 LLM 호출로 교체 시 이 함수만 바꾸면 됨.
 */
export function analyzeMinutes(input: AnalyzeMinutesInput): MeetingAnalysis {
	const { content } = input;
	const keywords = extractKeywords(content);
	const techStacks = extractTechStacks(content);
	const decisions = extractDecisions(content);
	const summary = generateSummary(content, keywords);
	const categories = classifyMinute(content);

	return {
		keywords,
		techStacks,
		decisions,
		summary,
		categories,
		analyzedAt: new Date().toISOString(),
	};
}
