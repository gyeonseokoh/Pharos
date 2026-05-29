/**
 * AgentService — AI 에이전트 Facade.
 *
 * 각 에이전트 기능을 IAgentTask 전략 객체로 위임.
 * LLM 공급자(OpenAI/Anthropic 등)와 검색 공급자는 생성자에서 주입.
 * API 키는 provider 내부에서 getter로 관리 — 외부 파라미터 불필요.
 */

import type { AvailabilityService } from "../../availability/services/availabilityService";
import type { MeetingsService } from "../../meeting/services/meetingsService";
import type { ProgressService } from "../../progress/services/progressService";
import type { RoadmapService } from "../../roadmap/services/roadmapService";
import type { TaskService } from "../../task/services/taskService";
import type { TeamService } from "../../team/services/teamService";
import type { ILLMProvider } from "../providers/ILLMProvider";
import type { ISearchProvider } from "../search/ISearchProvider";
import type {
	MinutesAnalysisInput,
	MinutesAnalysisResult,
	MinutesSummaryInput,
	MinutesSummaryResult,
	ProgressAnalysisInput,
	ProgressAnalysisResult,
	ResourceCollectionInput,
	ResourceCollectionResult,
	ScheduleCoordinationInput,
	ScheduleCoordinationResult,
	TaskBreakdownInput,
	TaskBreakdownResult,
} from "../domain/agentSchema";

import { AgentExecutor } from "../executor/AgentExecutor";
import { ScheduleCoordinationTask } from "../tasks/ScheduleCoordinationTask";
import { MinutesAnalysisTask } from "../tasks/MinutesAnalysisTask";
import { ProgressAnalysisTask } from "../tasks/ProgressAnalysisTask";
import { ResourceCollectionTask } from "../tasks/ResourceCollectionTask";
import { TaskBreakdownTask } from "../tasks/TaskBreakdownTask";
import { MinutesSummaryTask } from "../tasks/MinutesSummaryTask";

// 일정 조율 UI(PO-4 달력·가용시간 표시)에서 사용하는 날짜·시간 헬퍼
export {
	dayToDate,
	addDays,
	toMinutes,
	timesOverlap,
	timesConflictWithBuffer,
} from "../tasks/ScheduleCoordinationTask";

export class AgentService {
	readonly executor: AgentExecutor;
	readonly tasks: {
		coordinateSchedule: ScheduleCoordinationTask;
		analyzeMinutes: MinutesAnalysisTask;
		analyzeProgress: ProgressAnalysisTask;
		collectResources: ResourceCollectionTask;
		breakdownTask: TaskBreakdownTask;
		summarizeMinutes: MinutesSummaryTask;
	};

	constructor(
		teamService: TeamService,
		availabilityService: AvailabilityService,
		meetingsService: MeetingsService,
		progressService: ProgressService,
		taskService: TaskService,
		roadmapService: RoadmapService,
		llmProvider: ILLMProvider,
		searchProvider: ISearchProvider,
	) {
		const context = {
			teamService,
			availabilityService,
			meetingsService,
			progressService,
			taskService,
			roadmapService,
		};
		this.executor = new AgentExecutor(llmProvider, context);
		this.tasks = {
			coordinateSchedule: new ScheduleCoordinationTask(),
			analyzeMinutes: new MinutesAnalysisTask(),
			analyzeProgress: new ProgressAnalysisTask(),
			collectResources: new ResourceCollectionTask(searchProvider, llmProvider),
			breakdownTask: new TaskBreakdownTask(),
			summarizeMinutes: new MinutesSummaryTask(),
		};
	}

	async coordinateSchedule(
		input: ScheduleCoordinationInput,
	): Promise<ScheduleCoordinationResult> {
		return this.executor.execute(this.tasks.coordinateSchedule, input);
	}

	async analyzeMinutes(
		input: MinutesAnalysisInput,
	): Promise<MinutesAnalysisResult> {
		return this.executor.execute(this.tasks.analyzeMinutes, input);
	}

	async analyzeProgress(
		input: ProgressAnalysisInput,
	): Promise<ProgressAnalysisResult> {
		return this.executor.execute(this.tasks.analyzeProgress, input);
	}

	async collectResources(
		input: ResourceCollectionInput,
	): Promise<ResourceCollectionResult> {
		return this.executor.execute(this.tasks.collectResources, input);
	}

	async breakdownTask(input: TaskBreakdownInput): Promise<TaskBreakdownResult> {
		return this.executor.execute(this.tasks.breakdownTask, input);
	}

	async summarizeMinutes(
		input: MinutesSummaryInput,
	): Promise<MinutesSummaryResult> {
		return this.executor.execute(this.tasks.summarizeMinutes, input);
	}
}
