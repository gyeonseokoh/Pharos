/**
 * AgentService — AI 에이전트 기능 Facade.
 *
 * 다른 Feature Service를 조합하여 OpenAI에 필요한 컨텍스트를 구성하고
 * 구조화된 결과를 반환한다.
 *
 * 현재 구현된 기능:
 *   - analyzeProgress: Feature 3 — 진행 상황 분석
 *
 * PM-3(업무진행체크) 데이터: task.checklist[].checked → 체크리스트 완료율
 * PM-4(진척도검증)   데이터: task.linkedCommits[].verifyResult → 커밋 검증 현황
 */

import OpenAI from "openai";
import type { Task } from "features/task/domain/taskSchema";
import type { Roadmap } from "features/roadmap/domain/roadmapSchema";
import type {
	MemberProgressSummary,
	TaskProgressSummary,
} from "features/progress/services/progressService";
import type { ProgressService } from "features/progress/services/progressService";
import type { TaskService } from "features/task/services/taskService";
import type { RoadmapService } from "features/roadmap/services/roadmapService";
import type { TeamService } from "features/team/services/teamService";
import type {
	MemberHighlight,
	ProgressAnalysisInput,
	ProgressAnalysisResult,
	ProgressInsight,
} from "../domain/agentSchema";

// ─── 프롬프트 빌더 ───

interface ChecklistStats {
	total: number;
	checked: number;
	rate: number | null; // null = 항목 없음
}

interface CommitStats {
	tasksWithCommits: number;
	verifiedTasks: number;
}

/** PO-12 2축 데이터 — 팀원 1인당 효성도 + 완료체크 */
interface MemberTwoAxisStats {
	/** 효성도 축: verified 커밋이 연결된 Task 수 */
	verifiedTaskCount: number;
	/** 완료체크 축: userChecked=true 인 Task 수 */
	userCheckedCount: number;
}

function buildProgressPrompt(
	asOf: string,
	taskSummary: TaskProgressSummary,
	memberSummaries: MemberProgressSummary[],
	blockedTasks: Task[],
	roadmap: Roadmap | null,
	memberMap: Map<string, string>,
	checklistStats: ChecklistStats,
	commitStats: CommitStats,
	memberStatsMap: Map<string, MemberTwoAxisStats>,
): string {
	const lines: string[] = [
		"당신은 소프트웨어 프로젝트의 진행 상황을 분석하는 PM 어시스턴트입니다.",
		"",
		`오늘 날짜: ${asOf}`,
		"",
		"## 전체 Task 요약",
		`- 총 Task: ${taskSummary.total}개`,
		`- 할 일(ToDo): ${taskSummary.todo}개`,
		`- 진행 중: ${taskSummary.inProgress}개`,
		`- 완료: ${taskSummary.done}개`,
		`- 블록됨: ${taskSummary.blocked}개`,
		`- Task 완료율: ${taskSummary.completionRate}%`,
		"",
	];

	// PM-3 체크리스트 데이터
	if (checklistStats.total > 0) {
		lines.push("## 체크리스트 진행도 (PM-3 체크 데이터)");
		lines.push(`- 전체 체크리스트 항목: ${checklistStats.total}개`);
		lines.push(
			`- 완료된 항목: ${checklistStats.checked}개 (${checklistStats.rate ?? 0}%)`,
		);
		lines.push("");
	}

	// PM-4 커밋 검증 데이터
	if (commitStats.tasksWithCommits > 0) {
		lines.push("## 커밋 검증 현황 (PM-4 검증 데이터)");
		lines.push(`- 커밋이 연결된 Task: ${commitStats.tasksWithCommits}개`);
		lines.push(
			`- 검증 완료(verified) Task: ${commitStats.verifiedTasks}개`,
		);
		lines.push(
			`- 미검증 Task: ${commitStats.tasksWithCommits - commitStats.verifiedTasks}개`,
		);
		lines.push("");
	}

	if (roadmap && roadmap.phases.length > 0) {
		lines.push("## 개발 로드맵 단계");
		for (const phase of roadmap.phases) {
			lines.push(
				`- ${phase.name}: ${phase.start} ~ ${phase.end} (${phase.status})`,
			);
		}
		lines.push("");
	}

	if (blockedTasks.length > 0) {
		lines.push("## 블록된 Task");
		for (const t of blockedTasks) {
			lines.push(`- ${t.id}: ${t.title}`);
		}
		lines.push("");
	}

	if (memberSummaries.length > 0) {
		lines.push("## 팀원별 진행 현황 (PO-12 2축: 효성도 + 완료체크)");
		for (const m of memberSummaries) {
			const name = memberMap.get(m.memberId) ?? m.memberId;
			const rate =
				m.total === 0 ? 0 : Math.round((m.done / m.total) * 100);
			const stats = memberStatsMap.get(m.memberId);
			const twoAxis = stats
				? `, 검증커밋 Task ${stats.verifiedTaskCount}개(효성도), 완료체크 ${stats.userCheckedCount}개`
				: "";
			lines.push(
				`- ${name}(${m.memberId}): ${m.done}/${m.total}개 완료 (${rate}%), 진행중 ${m.inProgress}개${twoAxis}`,
			);
		}
		lines.push("");
	}

	// completionRate는 AI에게 요청하지 않음 — 실제 memberSummaries에서 직접 계산
	const memberHighlightExample =
		memberSummaries.length > 0
			? memberSummaries.map((m) => ({
					memberId: m.memberId,
					highlight: "한국어 한 줄 요약",
				}))
			: [{ memberId: "m1", highlight: "한국어 한 줄 요약" }];

	lines.push(
		"위 데이터를 기반으로 프로젝트 상태를 분석하고 아래 JSON 형식으로 응답해주세요.",
		"반드시 유효한 JSON만 반환하세요.",
		"",
		"응답 형식:",
		JSON.stringify(
			{
				overallHealth: "on-track | at-risk | critical",
				insights: [
					{
						type: "milestone | risk | achievement | recommendation",
						message: "한국어 분석 내용",
						relatedTaskIds: ["TASK-1"],
					},
				],
				memberHighlights: memberHighlightExample,
				summary: "한국어 2-3문장 전체 요약",
			},
			null,
			2,
		),
		"",
		"규칙:",
		"- overallHealth: 일정대로 진행 중이면 'on-track', 블로커·지연 위험이 있으면 'at-risk', 심각한 지연이면 'critical'",
		"- insights: 3~5개. type은 milestone/risk/achievement/recommendation 중 선택",
		"- 체크리스트 완료율과 커밋 검증 현황을 insights에 반영할 것",
		"- relatedTaskIds는 관련 Task가 있을 때만 포함",
		"- memberHighlights: 모든 팀원 포함. completionRate는 포함하지 말 것 (시스템이 실데이터로 계산)",
		"- ❌ AI 추정 비율 표현 금지: '약 X% 완료', '절반 정도 진행' 같은 가상 추정 표현 사용 금지",
		"- ✅ 제공된 집계 수치 인용 허용: 'N개 중 M개 완료', 'blocked Task N개' 등 실제 수치 기반 표현만 사용",
		"- 모든 텍스트(message, highlight, summary)는 한국어로 작성",
	);

	return lines.join("\n");
}

// ─── AgentService ───

export class AgentService {
	constructor(
		private readonly progressService: ProgressService,
		private readonly taskService: TaskService,
		private readonly roadmapService: RoadmapService,
		private readonly teamService: TeamService,
	) {}

	/**
	 * Feature 3: 진행 상황 분석.
	 *
	 * Task 현황, 체크리스트(PM-3), 커밋 검증(PM-4), 로드맵 단계,
	 * 팀원별 기여도를 종합해 프로젝트 건강도를 진단한다.
	 */
	async analyzeProgress(
		input: ProgressAnalysisInput,
		openaiApiKey: string,
	): Promise<ProgressAnalysisResult> {
		const {
			asOf = new Date().toISOString().slice(0, 10),
			includeBlocked = true,
			includeMemberDetails = true,
		} = input;

		// 1. 전체 Task 진행도 집계 (Task 상태 기준 완료율)
		const taskSummary = await this.progressService.getTaskSummary();

		// 2. 팀원별 진행도 집계
		const memberSummaries = includeMemberDetails
			? await this.progressService.getMemberSummaries()
			: [];

		// 3. 전체 Task 목록 — PM-3/PM-4 데이터 추출 + blocked 상세 용도
		const allTasks = await this.taskService.list();

		// 4. blocked Task 상세 (includeBlocked 옵션 적용)
		const blockedTasks = includeBlocked
			? allTasks.filter((t) => t.status === "blocked")
			: [];

		// 5. PM-3 체크리스트 통계
		const checklistTotal = allTasks.reduce(
			(sum, t) => sum + (t.checklist?.length ?? 0),
			0,
		);
		const checklistChecked = allTasks.reduce(
			(sum, t) =>
				sum + (t.checklist?.filter((c) => c.checked).length ?? 0),
			0,
		);
		const checklistStats: ChecklistStats = {
			total: checklistTotal,
			checked: checklistChecked,
			rate:
				checklistTotal === 0
					? null
					: Math.round((checklistChecked / checklistTotal) * 100),
		};

		// 6. PM-4 커밋 검증 통계
		const tasksWithCommits = allTasks.filter(
			(t) => (t.linkedCommits?.length ?? 0) > 0,
		);
		const verifiedTaskCount = tasksWithCommits.filter((t) =>
			t.linkedCommits.some((c) => c.verifyResult === "verified"),
		).length;
		const commitStats: CommitStats = {
			tasksWithCommits: tasksWithCommits.length,
			verifiedTasks: verifiedTaskCount,
		};

		// 7. 개발 로드맵 (단계별 마감일 컨텍스트)
		const roadmap = await this.roadmapService.getDevelopment();

		// 8. 팀원 이름 매핑 (id → name)
		const members = await this.teamService.listActive();
		const memberMap = new Map(members.map((m) => [m.id, m.name]));

		// 8-1. PO-12 2축: 팀원별 효성도(검증커밋 Task) + 완료체크(userChecked) 집계
		const memberStatsMap = new Map<string, MemberTwoAxisStats>();
		for (const m of memberSummaries) {
			const memberTasks = allTasks.filter(
				(t) => t.assignee?.id === m.memberId,
			);
			memberStatsMap.set(m.memberId, {
				verifiedTaskCount: memberTasks.filter((t) =>
					t.linkedCommits.some((c) => c.verifyResult === "verified"),
				).length,
				userCheckedCount: memberTasks.filter((t) => t.userChecked).length,
			});
		}

		// 9. OpenAI 호출
		const prompt = buildProgressPrompt(
			asOf,
			taskSummary,
			memberSummaries,
			blockedTasks,
			roadmap,
			memberMap,
			checklistStats,
			commitStats,
			memberStatsMap,
		);

		const openai = new OpenAI({
			apiKey: openaiApiKey,
			dangerouslyAllowBrowser: true,
		});
		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: prompt }],
			response_format: { type: "json_object" },
			temperature: 0.3,
		});

		const raw = completion.choices[0]?.message?.content ?? "{}";
		const parsed = JSON.parse(raw) as {
			overallHealth?: "on-track" | "at-risk" | "critical";
			insights?: Array<{
				type?: string;
				message?: string;
				relatedTaskIds?: string[];
			}>;
			memberHighlights?: Array<{
				memberId?: string;
				highlight?: string;
			}>;
			summary?: string;
		};

		// 10. 타입 정제 및 이름 enrichment
		const validInsightTypes = new Set([
			"milestone",
			"risk",
			"achievement",
			"recommendation",
		]);
		const insights: ProgressInsight[] = (parsed.insights ?? []).map(
			(i) => ({
				type: (validInsightTypes.has(i.type ?? "")
					? i.type
					: "recommendation") as ProgressInsight["type"],
				message: i.message ?? "",
				...(i.relatedTaskIds?.length
					? { relatedTaskIds: i.relatedTaskIds }
					: {}),
			}),
		);

		const memberHighlights: MemberHighlight[] = (
			parsed.memberHighlights ?? []
		).map((h) => {
			const memberId = h.memberId ?? "";
			const ms = memberSummaries.find((m) => m.memberId === memberId);
			const stats = memberStatsMap.get(memberId);
			const completionRate =
				ms && ms.total > 0 ? Math.round((ms.done / ms.total) * 100) : 0;
			return {
				memberId,
				memberName: memberMap.get(memberId) ?? memberId,
				completionRate, // 실데이터 기반 계산 (PO-12: AI 추정 % 금지)
				verifiedTaskCount: stats?.verifiedTaskCount ?? 0, // PO-12 효성도 축
				userCheckedCount: stats?.userCheckedCount ?? 0, // PO-12 완료체크 축
				highlight: h.highlight ?? "",
			};
		});

		return {
			asOf,
			overallHealth: parsed.overallHealth ?? "at-risk",
			completionRate: taskSummary.completionRate,
			checklistCompletionRate: checklistStats.rate,
			verifiedTaskCount,
			insights,
			blockedTasks: blockedTasks.map((t) => ({
				id: t.id,
				title: t.title,
			})),
			memberHighlights,
			summary: parsed.summary ?? "",
		};
	}
}
