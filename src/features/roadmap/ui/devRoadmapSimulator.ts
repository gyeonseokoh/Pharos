/**
 * devRoadmapSimulator — PO-6 개발 로드맵 자동 생성 시뮬레이터.
 *
 * 실제 AI·서버 없이 로컬에서 5단계 분석을 흉내낸다.
 * 나중에 llmClient가 붙으면 각 함수 내부를 API 호출로 교체하면 됨.
 *
 * 5단계 (시나리오 PO-6):
 *   1) 회의록 분석 → 기능·기술 요소 추출 (analyzeMinutes)
 *   2) 기능 단위 → Task 목록 생성 (generateTasks)
 *   3) 선후관계 + 우선순위 계산 (computeDependencies)
 *   4) 기술스택 매칭 → 담당자 배정 (assignByTechStack)
 *   5) 일정 계산 (calculateSchedule)
 */

import type { MeetingPageData } from "../../meeting/domain/meetingPageData";
import type { TeamMember } from "../../team/domain/teamListData";
import type { ProjectReport } from "../../../app/settings";
import type {
	RoadmapData,
	RoadmapPhase,
	RoadmapTask,
} from "../domain/roadmapData";

// ───────────────────────── Public ─────────────────────────

export interface GenerateDevRoadmapInput {
	report: ProjectReport;
	meetings: MeetingPageData[];
	members: TeamMember[];
	/** 기획 로드맵의 마지막 phase 종료일. 개발 시작 기준일. */
	planningEndIso: string;
}

/**
 * 5단계 전부 순서대로 실행하고 최종 RoadmapData 반환.
 * 각 단계는 동기 함수이지만 Modal에서 progress 표시용으로 단계별로 await 가능.
 */
export function generateDevelopmentRoadmap(
	input: GenerateDevRoadmapInput,
): RoadmapData {
	const features = analyzeMinutes(input.meetings);
	const rawTasks = generateTasks(features);
	const withDeps = computeDependencies(rawTasks);
	const withAssignees = assignByTechStack(withDeps, input.members);
	const scheduled = calculateSchedule(
		withAssignees,
		input.planningEndIso,
		input.report.deadline,
	);
	const phases = buildPhases(input.planningEndIso, input.report.deadline);

	return {
		project: {
			name: input.report.name,
			start: input.planningEndIso,
			end: input.report.deadline,
		},
		phases,
		tasks: scheduled,
	};
}

// ───────────────────────── Stage 1. 회의록 분석 ─────────────────────────

export interface ExtractedFeature {
	id: string;
	name: string;
	techKeywords: string[];
	/** 출처 회의록들. */
	sourceMeetingIds: string[];
}

/**
 * 회의록의 topics + analysis.decisions 에서 기능 단위로 추출.
 * 지금은 mock: topic.title을 "기능명" 으로 간주.
 */
export function analyzeMinutes(meetings: MeetingPageData[]): ExtractedFeature[] {
	const features: Map<string, ExtractedFeature> = new Map();

	for (const m of meetings) {
		for (const t of m.topics) {
			// 이미 비슷한 이름 있으면 출처만 추가
			const key = normalizeName(t.title);
			const existing = features.get(key);
			if (existing) {
				if (!existing.sourceMeetingIds.includes(m.id)) {
					existing.sourceMeetingIds.push(m.id);
				}
				continue;
			}
			features.set(key, {
				id: `feat-${features.size + 1}`,
				name: t.title,
				techKeywords: extractTechKeywords(t.title + " " + (t.description ?? "")),
				sourceMeetingIds: [m.id],
			});
		}

		// analysis.techStacks도 기능 단위는 아니지만 tech keyword 보강용
		if (m.analysis?.techStacks) {
			// 기존 features에 해당 회의 id 있으면 techKeywords 추가
			for (const feat of features.values()) {
				if (feat.sourceMeetingIds.includes(m.id)) {
					for (const tech of m.analysis.techStacks) {
						if (!feat.techKeywords.includes(tech)) {
							feat.techKeywords.push(tech);
						}
					}
				}
			}
		}
	}

	return Array.from(features.values());
}

function normalizeName(s: string): string {
	return s.trim().toLowerCase();
}

/** title + description에서 기술 키워드 추출 (단순 문자열 매칭). */
function extractTechKeywords(text: string): string[] {
	const KNOWN = [
		"React",
		"TypeScript",
		"Node.js",
		"Python",
		"Yjs",
		"Hocuspocus",
		"SQLite",
		"OpenAI",
		"LangChain",
		"GitHub",
		"API",
		"Figma",
		"UI/UX",
		"Obsidian",
		"Tavily",
		"JWT",
		"WebSocket",
	];
	const lower = text.toLowerCase();
	return KNOWN.filter((kw) => lower.includes(kw.toLowerCase()));
}

// ───────────────────────── Stage 2. Task 생성 ─────────────────────────

/** 각 feature → Task 1~2개. */
export function generateTasks(
	features: ExtractedFeature[],
): RoadmapTask[] {
	const tasks: RoadmapTask[] = [];
	let counter = 1;

	for (const feat of features) {
		// 메인 구현 task
		tasks.push({
			id: `task-dev-${String(counter++).padStart(3, "0")}`,
			name: feat.name,
			kind: "task",
			status: "todo",
			start: "", // 나중에 calculateSchedule에서 채움
			end: "",
			progress: 0,
			sourceMeetings: feat.sourceMeetingIds,
		});

		// 복잡한 feature (tech keyword 2개 이상)는 테스트 task 별도
		if (feat.techKeywords.length >= 2) {
			tasks.push({
				id: `task-dev-${String(counter++).padStart(3, "0")}`,
				name: `${feat.name} — 테스트 · 검증`,
				kind: "task",
				status: "todo",
				start: "",
				end: "",
				progress: 0,
				sourceMeetings: feat.sourceMeetingIds,
			});
		}
	}

	return tasks;
}

// ───────────────────────── Stage 3. 선후관계 · 우선순위 ─────────────────────────

/**
 * 단순 규칙:
 *   - "테스트" 이름 포함 task는 같은 feature의 구현 task에 dependsOn
 *   - 나머지는 순차 (이전 task 끝나야 시작)
 */
export function computeDependencies(tasks: RoadmapTask[]): RoadmapTask[] {
	return tasks.map((t, i) => {
		const deps: string[] = [];
		if (t.name.includes("테스트") && i > 0) {
			// 직전 task가 같은 feature의 구현
			deps.push(tasks[i - 1]!.id);
		} else if (i > 0 && i % 2 === 0) {
			// 매 2번째 task마다 이전 task 선행
			deps.push(tasks[i - 1]!.id);
		}
		return deps.length > 0 ? { ...t, dependsOn: deps } : t;
	});
}

// ───────────────────────── Stage 4. 담당자 배정 ─────────────────────────

/**
 * 각 Task의 name·sourceMeetings에서 언급된 기술과 팀원 techStacks 매칭.
 * 가장 많이 겹치는 팀원 배정. 동점이면 현재까지 assign 수가 적은 팀원 우선 (균등 분배).
 */
export function assignByTechStack(
	tasks: RoadmapTask[],
	members: TeamMember[],
): RoadmapTask[] {
	const activeMembers = members.filter((m) => m.isActive);
	const assignCount: Record<string, number> = {};
	for (const m of activeMembers) assignCount[m.id] = 0;

	return tasks.map((task) => {
		const scores = activeMembers.map((m) => ({
			member: m,
			score: scoreMatch(task.name, m.techStacks),
		}));

		scores.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			// 점수 같으면 배정 수 적은 쪽 우선
			return (
				(assignCount[a.member.id] ?? 0) -
				(assignCount[b.member.id] ?? 0)
			);
		});

		const best = scores[0]?.member;
		if (best) {
			assignCount[best.id] = (assignCount[best.id] ?? 0) + 1;
			return { ...task, assignee: best.name };
		}
		return task;
	});
}

function scoreMatch(taskName: string, techStacks: string[]): number {
	const lower = taskName.toLowerCase();
	return techStacks.reduce(
		(sum, tech) => (lower.includes(tech.toLowerCase()) ? sum + 1 : sum),
		0,
	);
}

// ───────────────────────── Stage 5. 일정 계산 ─────────────────────────

/**
 * 개발 시작일 ~ 프로젝트 마감까지를 task 수로 나눠 균등 배치.
 * 의존성 있는 task는 선행 task 끝난 후 시작.
 */
export function calculateSchedule(
	tasks: RoadmapTask[],
	startIso: string,
	endIso: string,
): RoadmapTask[] {
	const start = new Date(startIso + "T00:00:00");
	const end = new Date(endIso + "T00:00:00");
	const totalDays = Math.max(
		1,
		Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
	);
	// 의존성 없는 task는 병렬, 있는 task는 순차. 단순화 위해 순차 배치.
	const taskDuration = Math.max(
		2,
		Math.floor(totalDays / Math.max(1, tasks.length)),
	);

	const scheduled: RoadmapTask[] = [];
	let cursor = new Date(start);

	for (const t of tasks) {
		const s = new Date(cursor);
		const e = new Date(cursor);
		e.setDate(e.getDate() + taskDuration);
		if (e > end) e.setTime(end.getTime());
		scheduled.push({
			...t,
			start: toIso(s),
			end: toIso(e),
		});
		// 다음 task는 현재 종료 다음날부터 (단순 순차)
		cursor = new Date(e);
		cursor.setDate(cursor.getDate() + 1);
	}

	return scheduled;
}

function toIso(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

// ───────────────────────── Phase 생성 (시각화용) ─────────────────────────

/** 개발 기간을 4구간으로 나눠 phase 생성 (기획·MVP·통합·배포). */
function buildPhases(startIso: string, endIso: string): RoadmapPhase[] {
	const start = new Date(startIso + "T00:00:00");
	const end = new Date(endIso + "T00:00:00");
	const totalMs = end.getTime() - start.getTime();
	const chunk = totalMs / 4;

	const at = (frac: number): string => {
		const d = new Date(start.getTime() + chunk * frac);
		return toIso(d);
	};

	return [
		{
			id: "dev-mvp",
			name: "MVP 기능 개발",
			start: at(0),
			end: at(1.5),
			status: "todo",
			icon: "code",
			color: "#3b82f6",
			activities: ["핵심 기능 구현", "UI 통합"],
		},
		{
			id: "dev-integration",
			name: "서버·AI 연동",
			start: at(1.2),
			end: at(2.5),
			status: "todo",
			icon: "server",
			color: "#8b5cf6",
			activities: ["API 연동", "인증·동기화"],
		},
		{
			id: "dev-test",
			name: "통합 테스트",
			start: at(2.3),
			end: at(3.5),
			status: "todo",
			icon: "flask",
			color: "#ec4899",
			activities: ["시나리오 테스트", "버그 수정"],
		},
		{
			id: "dev-release",
			name: "최종 배포",
			start: at(3.3),
			end: at(4),
			status: "todo",
			icon: "rocket",
			color: "#10b981",
			activities: ["배포 준비", "최종 발표"],
		},
	];
}

// ───────────────────────── Step 진행 제어 ─────────────────────────

/**
 * Modal UI에서 "단계별 progress" 표현을 위해 각 단계를 await 가능한 형태로 래핑.
 * 실제 계산은 즉시 끝나지만 UX 위해 인위적 delay를 둠.
 */
export const DEV_ROADMAP_STEPS = [
	{ key: "analyze", label: "회의록 분석 · 기능 추출" },
	{ key: "generate", label: "Task 목록 생성" },
	{ key: "dependencies", label: "선후관계 · 우선순위 계산" },
	{ key: "assign", label: "담당자 기술스택 매칭" },
	{ key: "schedule", label: "일정 계산 · 간트 렌더" },
] as const;

export type DevRoadmapStepKey = (typeof DEV_ROADMAP_STEPS)[number]["key"];
