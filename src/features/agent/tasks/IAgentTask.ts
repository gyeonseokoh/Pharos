import type { LLMRequest } from "../domain/llmSchema";
import type { AvailabilityService } from "../../availability/services/availabilityService";
import type { MeetingsService } from "../../meeting/services/meetingsService";
import type { ProgressService } from "../../progress/services/progressService";
import type { RoadmapService } from "../../roadmap/services/roadmapService";
import type { TaskService } from "../../task/services/taskService";
import type { TeamService } from "../../team/services/teamService";

export interface AgentContext {
	teamService: TeamService;
	availabilityService: AvailabilityService;
	meetingsService: MeetingsService;
	progressService: ProgressService;
	taskService: TaskService;
	roadmapService: RoadmapService;
}

export interface IAgentTask<TInput, TResult> {
	buildRequest(input: TInput, ctx: AgentContext): Promise<LLMRequest>;
	/** request는 buildRequest가 반환한 객체 그대로 — metadata로 준비 데이터 전달 가능. */
	parseResponse(raw: string, request: LLMRequest, input: TInput, ctx: AgentContext): TResult;
}
