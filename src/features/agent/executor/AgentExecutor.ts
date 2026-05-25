import type { ILLMProvider } from "../providers/ILLMProvider";
import type { AgentContext, IAgentTask } from "../tasks/IAgentTask";

export class AgentExecutor {
	constructor(
		private readonly defaultProvider: ILLMProvider,
		private readonly context: AgentContext,
	) {}

	async execute<TInput, TResult>(
		task: IAgentTask<TInput, TResult>,
		input: TInput,
		providerOverride?: ILLMProvider,
	): Promise<TResult> {
		const provider = providerOverride ?? this.defaultProvider;
		const request = await task.buildRequest(input, this.context);

		// Bypass: empty messages = task handled everything in buildRequest (e.g. ResourceCollectionTask)
		if (request.messages.length === 0) {
			return task.parseResponse("", request, input, this.context);
		}

		const response = await provider.complete(request);
		return task.parseResponse(response.content, request, input, this.context);
	}
}
