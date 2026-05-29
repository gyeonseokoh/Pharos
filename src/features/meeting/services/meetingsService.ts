/**
 * MeetingsService — 회의·회의록·분석 관련 비즈니스 로직 Facade.
 *
 * UI·백엔드·AI 에이전트가 모두 이 Service를 통해 회의 조작.
 * 내부에서 Repository + 분석 시뮬레이터(또는 LLM) 호출 + 도메인 이벤트 발행.
 */

import { eventBus } from "../../../shared/repo/eventBus";
import { analyzeMinutes } from "../ui/minutesAnalysisSimulator";
import type {
	AttachMinutesInput,
	Meeting,
	MeetingAnalysis,
	MeetingCategory,
	MeetingFilter,
	MeetingTopic,
	TopicSource,
} from "../domain/meetingSchema";
import type { MeetingRepository } from "../repositories/meetingRepository";

export class MeetingsService {
	constructor(private readonly repo: MeetingRepository) {}

	/** 전체 회의 목록 (필터 옵션). */
	async list(filter?: MeetingFilter): Promise<Meeting[]> {
		return this.repo.list(filter);
	}

	/** ID로 단일 회의 조회. */
	async getById(id: string): Promise<Meeting | null> {
		return this.repo.getById(id);
	}

	/** 회의록이 아직 없는 회의 후보 목록 (회의록 작성 모달 드롭다운용). */
	async listMeetingsWithoutMinutes(): Promise<Meeting[]> {
		return this.repo.listMeetingsWithoutMinutes();
	}

	/** 카테고리별 회의록 (회의록 관리 탭 필터). */
	async listByCategory(category: MeetingCategory): Promise<Meeting[]> {
		return this.repo.listByCategory(category);
	}

	/**
	 * PO-5 회의록 첨부.
	 *
	 * 책임:
	 *   - 분석 시뮬레이터(향후 LLM) 호출하여 키워드·결정사항·카테고리 추출
	 *   - Repository 저장 (회의에 minutes·analysis 합쳐 저장)
	 *   - "minutes:attached" 이벤트 발행
	 */
	async attachMinutes(input: AttachMinutesInput): Promise<MeetingAnalysis> {
		const meeting = await this.repo.getById(input.meetingId);
		if (!meeting) throw new Error(`회의 ${input.meetingId} 를 찾을 수 없습니다`);

		const analysis = analyzeMinutes({ content: input.content });

		const updated: Meeting = {
			...meeting,
			minutes: {
				authorName: input.authorName,
				writtenAt: new Date().toISOString(),
				content: input.content,
			},
			analysis,
			status: "completed",
			updatedAt: new Date().toISOString(),
		};
		await this.repo.save(updated);
		eventBus.emit("minutes:attached", { meetingId: input.meetingId });
		return analysis;
	}

	/**
	 * PO-2 AI 회의 주제 생성 / 사용자 수동 추가 시 회의에 주제 누적.
	 *
	 * 호출자(AiTopicModal)가 선택한 주제 목록을 전달하면 id 자동 발급 후 저장.
	 * 빈 제목은 자동 제외. 1회 save + 1회 meeting:updated 이벤트.
	 *
	 * source 값:
	 *   - "AI": LLM 추천 후 사용자가 채택한 주제 (suggestedTopics 출처)
	 *   - "MANUAL": 사용자가 직접 입력한 주제
	 */
	async appendTopics(
		meetingId: string,
		incoming: Array<{
			title: string;
			source: TopicSource;
			reason?: string | null;
			priority?: number;
			description?: string;
		}>,
	): Promise<MeetingTopic[]> {
		const meeting = await this.repo.getById(meetingId);
		if (!meeting) throw new Error(`회의 ${meetingId} 를 찾을 수 없습니다`);

		const now = Date.now();
		const rnd = () => Math.random().toString(36).slice(2, 6);
		const added: MeetingTopic[] = incoming
			.filter((t) => t.title.trim().length > 0)
			.map((t, i) => ({
				id: `topic-${now}-${i}-${rnd()}`,
				title: t.title.trim(),
				description: t.description,
				priority: t.priority ?? 3,
				source: t.source,
				reason: t.reason ?? null,
			}));

		if (added.length === 0) return [];

		await this.repo.save({
			...meeting,
			topics: [...meeting.topics, ...added],
			// 첫 주제 추가 시 status 를 ready 로 자동 갱신 (BR-2 회의 생성-주제-시작 흐름)
			status:
				meeting.topics.length === 0 && meeting.status === "topic_pending"
					? "ready"
					: meeting.status,
			updatedAt: new Date().toISOString(),
		});
		eventBus.emit("meeting:updated", { meetingId });
		return added;
	}

	/** 회의록 삭제 (시연·테스트용). 회의 자체는 유지, attachedMinutes만 제거. */
	async detachMinutes(meetingId: string): Promise<void> {
		await this.repo.delete(meetingId);
		eventBus.emit("meeting:updated", { meetingId });
	}
}
