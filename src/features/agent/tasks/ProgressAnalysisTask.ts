import type { IAgentTask, AgentContext } from "./IAgentTask";
import type { LLMRequest } from "../domain/llmSchema";
import type {
	ProgressAnalysisInput,
	ProgressAnalysisResult,
	ProgressInsight,
	MemberHighlight,
} from "../domain/agentSchema";
import type { Task } from "../../task/domain/taskSchema";
import type { Roadmap } from "../../roadmap/domain/roadmapSchema";
import type {
	MemberProgressSummary,
	TaskProgressSummary,
} from "../../progress/services/progressService";

interface ChecklistStats {
	total: number;
	checked: number;
	rate: number | null;
}

interface CommitStats {
	tasksWithCommits: number;
	verifiedTasks: number;
}

interface MemberTwoAxisStats {
	verifiedTaskCount: number;
	userCheckedCount: number;
}

interface ProgressMetadata {
	taskSummary: TaskProgressSummary;
	memberSummaries: MemberProgressSummary[];
	blockedTasks: Task[];
	checklistStats: ChecklistStats;
	commitStats: CommitStats;
	memberMap: Map<string, string>;
	memberStatsMap: Map<string, MemberTwoAxisStats>;
	verifiedTaskCount: number;
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

	if (checklistStats.total > 0) {
		lines.push("## 체크리스트 진행도 (PM-3 체크 데이터)");
		lines.push(`- 전체 체크리스트 항목: ${checklistStats.total}개`);
		lines.push(`- 완료된 항목: ${checklistStats.checked}개 (${checklistStats.rate ?? 0}%)`);
		lines.push("");
	}

	if (commitStats.tasksWithCommits > 0) {
		lines.push("## 커밋 검증 현황 (PM-4 검증 데이터)");
		lines.push(`- 커밋이 연결된 Task: ${commitStats.tasksWithCommits}개`);
		lines.push(`- 검증 완료(verified) Task: ${commitStats.verifiedTasks}개`);
		lines.push(`- 미검증 Task: ${commitStats.tasksWithCommits - commitStats.verifiedTasks}개`);
		lines.push("");
	}

	if (roadmap && roadmap.phases.length > 0) {
		lines.push("## 개발 로드맵 단계");
		for (const phase of roadmap.phases) {
			lines.push(`- ${phase.name}: ${phase.start} ~ ${phase.end} (${phase.status})`);
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
			const rate = m.total === 0 ? 0 : Math.round((m.done / m.total) * 100);
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

	const memberHighlightExample =
		memberSummaries.length > 0
			? memberSummaries.map((m) => ({ memberId: m.memberId, highlight: "한국어 한 줄 요약" }))
			: [{ memberId: "m1", highlight: "한국어 한 줄 요약" }];

	lines.push(
		"위 데이터를 기반으로 프로젝트 상태를 분석하고 아래 JSON 형식으로 응답해주세요.",
		"반드시 유효한 JSON만 반환하세요.",
		"",
		"응답 형식:",
		JSON.stringify(
			{
				overallHealth: "on-track | at-risk | critical",
				insights: [{ type: "milestone | risk | achievement | recommendation", message: "한국어 분석 내용", relatedTaskIds: ["TASK-1"] }],
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
		"- relatedTaskIds는 관련 Task가 있을 때만 포함",
		"- memberHighlights: 모든 팀원 포함. completionRate는 포함하지 말 것 (시스템이 실데이터로 계산)",
		"- ❌ AI 추정 비율 표현 금지: '약 X% 완료', '절반 정도 진행' 같은 표현 금지",
		"- ✅ 실제 집계 수치 인용 허용: 'N개 중 M개 완료', 'blocked Task N개' 등",
		"- 모든 텍스트(message, highlight, summary)는 한국어로 작성",
	);

	return lines.join("\n");
}

export class ProgressAnalysisTask
	implements IAgentTask<ProgressAnalysisInput, ProgressAnalysisResult>
{
	async buildRequest(
		input: ProgressAnalysisInput,
		ctx: AgentContext,
	): Promise<LLMRequest> {
		const {
			asOf = new Date().toISOString().slice(0, 10),
			includeBlocked = true,
			includeMemberDetails = true,
		} = input;

		const taskSummary = await ctx.progressService.getTaskSummary();
		const memberSummaries = includeMemberDetails
			? await ctx.progressService.getMemberSummaries()
			: [];
		const allTasks = await ctx.taskService.list();
		const blockedTasks = includeBlocked
			? allTasks.filter((t) => t.status === "blocked")
			: [];

		const checklistTotal = allTasks.reduce((sum, t) => sum + (t.checklist?.length ?? 0), 0);
		const checklistChecked = allTasks.reduce(
			(sum, t) => sum + (t.checklist?.filter((c) => c.checked).length ?? 0),
			0,
		);
		const checklistStats: ChecklistStats = {
			total: checklistTotal,
			checked: checklistChecked,
			rate: checklistTotal === 0 ? null : Math.round((checklistChecked / checklistTotal) * 100),
		};

		const tasksWithCommits = allTasks.filter((t) => (t.linkedCommits?.length ?? 0) > 0);
		const verifiedTaskCount = tasksWithCommits.filter((t) =>
			t.linkedCommits.some((c) => c.verifyResult === "verified"),
		).length;
		const commitStats: CommitStats = {
			tasksWithCommits: tasksWithCommits.length,
			verifiedTasks: verifiedTaskCount,
		};

		const roadmap = await ctx.roadmapService.getDevelopment();
		const members = await ctx.teamService.listActive();
		const memberMap = new Map(members.map((m) => [m.id, m.name]));

		const memberStatsMap = new Map<string, MemberTwoAxisStats>();
		for (const m of memberSummaries) {
			const memberTasks = allTasks.filter((t) => t.assignee?.id === m.memberId);
			memberStatsMap.set(m.memberId, {
				verifiedTaskCount: memberTasks.filter((t) =>
					t.linkedCommits.some((c) => c.verifyResult === "verified"),
				).length,
				userCheckedCount: memberTasks.filter((t) => t.userChecked).length,
			});
		}

		const metadata: ProgressMetadata = {
			taskSummary,
			memberSummaries,
			blockedTasks,
			checklistStats,
			commitStats,
			memberMap,
			memberStatsMap,
			verifiedTaskCount,
		};

		return {
			messages: [
				{
					role: "user",
					content: buildProgressPrompt(
						asOf,
						taskSummary,
						memberSummaries,
						blockedTasks,
						roadmap,
						memberMap,
						checklistStats,
						commitStats,
						memberStatsMap,
					),
				},
			],
			jsonMode: true,
			temperature: 0.3,
			metadata,
		};
	}

	parseResponse(
		raw: string,
		request: LLMRequest,
		input: ProgressAnalysisInput,
	): ProgressAnalysisResult {
		const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);

		type ParsedProgress = {
			overallHealth?: "on-track" | "at-risk" | "critical";
			insights?: Array<{ type?: string; message?: string; relatedTaskIds?: string[] }>;
			memberHighlights?: Array<{ memberId?: string; highlight?: string }>;
			summary?: string;
		};

		let parsed: ParsedProgress = {};
		try {
			parsed = JSON.parse(raw) as ParsedProgress;
		} catch {
			console.warn("[Pharos Agent] ProgressAnalysisTask JSON parse failed");
		}

		const meta = request.metadata as ProgressMetadata | undefined;
		const taskSummary = meta?.taskSummary ?? { total: 0, todo: 0, inProgress: 0, done: 0, blocked: 0, completionRate: 0 };
		const memberSummaries = meta?.memberSummaries ?? [];
		const blockedTasks = meta?.blockedTasks ?? [];
		const memberMap = meta?.memberMap ?? new Map<string, string>();
		const memberStatsMap = meta?.memberStatsMap ?? new Map<string, MemberTwoAxisStats>();
		const verifiedTaskCount = meta?.verifiedTaskCount ?? 0;
		const checklistStats = meta?.checklistStats ?? { total: 0, checked: 0, rate: null };

		const validInsightTypes = new Set(["milestone", "risk", "achievement", "recommendation"]);
		const insights: ProgressInsight[] = (parsed.insights ?? []).map((i) => ({
			type: (validInsightTypes.has(i.type ?? "")
				? i.type
				: "recommendation") as ProgressInsight["type"],
			message: i.message ?? "",
			...(i.relatedTaskIds?.length ? { relatedTaskIds: i.relatedTaskIds } : {}),
		}));

		const memberHighlights: MemberHighlight[] = (parsed.memberHighlights ?? []).map((h) => {
			const memberId = h.memberId ?? "";
			const ms = memberSummaries.find((m) => m.memberId === memberId);
			const stats = memberStatsMap.get(memberId);
			const completionRate = ms && ms.total > 0 ? Math.round((ms.done / ms.total) * 100) : 0;
			return {
				memberId,
				memberName: memberMap.get(memberId) ?? memberId,
				completionRate,
				verifiedTaskCount: stats?.verifiedTaskCount ?? 0,
				userCheckedCount: stats?.userCheckedCount ?? 0,
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
			blockedTasks: blockedTasks.map((t) => ({ id: t.id, title: t.title })),
			memberHighlights,
			summary: parsed.summary ?? "",
		};
	}
}
