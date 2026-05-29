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
	 * PO-2 회의 주제 추가.
	 *
	 * AiTopicModal에서 PO가 AI 제안 주제를 선택·확정하거나 직접 입력한 후 호출.
	 * 기존 topics 배열에 append — 덮어쓰지 않음 (회의 합의로 쌓인 주제는 보존).
	 *
	 * status 전이:
	 *   topic_pending → ready  (주제가 생기면 "준비 완료"로 격상)
	 *   ready / completed      → 그대로 유지
	 *
	 * AI 연동 후에도 이 메서드는 그대로 사용 —
	 * AiTopicModal이 agentService.generateTopics() 결과를 받아
	 * 동일하게 addTopics()를 호출하면 됨.
	 */
	async addTopics(
		meetingId: string,
		topics: Pick<MeetingTopic, "title" | "source" | "reason">[],
	): Promise<void> {
		const meeting = await this.repo.getById(meetingId);
		if (!meeting) throw new Error(`회의 ${meetingId}를 찾을 수 없습니다`);

		// 기존 주제 수 기준으로 우선순위 순번 부여 (1~5 범위 내 클램프)
		const base = meeting.topics.length + 1;
		const newTopics: MeetingTopic[] = topics.map((t, i) => ({
			id: `topic-${Date.now()}-${i}`,
			title: t.title,
			priority: Math.min(base + i, 5),
			source: t.source,
			reason: t.reason,
		}));

		await this.repo.save({
			...meeting,
			topics: [...meeting.topics, ...newTopics],
			// 주제가 추가됐으므로 topic_pending → ready. 이미 ready/completed면 유지.
			status: meeting.status === "topic_pending" ? "ready" : meeting.status,
			updatedAt: new Date().toISOString(),
		});
		eventBus.emit("meeting:updated", { meetingId });
	}

	/**
	 * PO-4 임시 회의 생성.
	 *
	 * AdhocMeetingModal에서 PO가 날짜·시간·주제 선택 후 호출.
	 * meetingType "adhoc", status "topic_pending" 으로 초기화.
	 */
	async create(input: {
		title: string;
		date: string;
		time: string;
		durationMinutes?: number;
	}): Promise<Meeting> {
		const now = new Date().toISOString();
		const meeting: Meeting = {
			version: 1,
			type: "meeting",
			// Date.now()로 ID 유일성 보장 — 동시 생성 없는 단일 사용자 환경 가정
			id: `mtg-${Date.now()}`,
			title: input.title,
			date: input.date,
			time: input.time,
			durationMinutes: input.durationMinutes ?? 60,
			meetingType: "adhoc",
			status: "topic_pending",
			attendees: [],
			topics: [],
			resources: [],
			minutes: null,
			analysis: null,
			createdAt: now,
			updatedAt: now,
		};
		await this.repo.save(meeting);
		eventBus.emit("meeting:created", { meetingId: meeting.id });
		return meeting;
	}

	/**
	 * PO-8 수동 자료 추가.
	 *
	 * ResourceUploadModal에서 URL·제목·요약 입력 후 호출.
	 * Meeting.resources[] 배열에 항목 추가 후 저장.
	 */
	async addResource(
		meetingId: string,
		input: {
			title: string;
			url: string;
			summary: string;
			// "__general__" 이면 특정 주제 미연결(topicId = null)
			topicId: string;
		},
	): Promise<void> {
		const meeting = await this.repo.getById(meetingId);
		if (!meeting) throw new Error(`회의 ${meetingId}를 찾을 수 없습니다`);

		const resource: Meeting["resources"][number] = {
			id: `res-${Date.now()}`,
			topicId: input.topicId === "__general__" ? null : input.topicId,
			title: input.title,
			summary: input.summary,
			sourceUrl: input.url,
			collectedAt: new Date().toISOString(),
		};

		await this.repo.save({
			...meeting,
			resources: [...meeting.resources, resource],
			updatedAt: new Date().toISOString(),
		});
		eventBus.emit("meeting:updated", { meetingId });
	}

	/** 회의록 삭제 (시연·테스트용). 회의 자체는 유지, attachedMinutes만 제거. */
	async detachMinutes(meetingId: string): Promise<void> {
		await this.repo.delete(meetingId);
		eventBus.emit("meeting:updated", { meetingId });
	}
}
