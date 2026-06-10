/**
 * MeetingsService — 회의·회의록·분석 관련 비즈니스 로직 Facade.
 *
 * UI·백엔드·AI 에이전트가 모두 이 Service를 통해 회의 조작.
 * 내부에서 Repository + 분석 시뮬레이터(또는 LLM) 호출 + 도메인 이벤트 발행.
 */

import { eventBus } from "../../../shared/repo/eventBus";
import type {
	AttachMinutesInput,
	CreateMeetingInput,
	Meeting,
	MeetingAnalysis,
	MeetingCategory,
	MeetingFilter,
	MeetingResource,
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
	 * 새 회의 생성. (PO-4 임시 회의 / PO-1-1 정기 회의)
	 *
	 * 책임:
	 *   - id 자동 발급 (mtg-<date>-<slug>-<rand>)
	 *   - 기본값 채움 (status, 빈 배열들)
	 *   - Repository 저장
	 *   - "meeting:created" 이벤트 발행
	 */
	async create(input: CreateMeetingInput): Promise<Meeting> {
		const now = new Date().toISOString();
		const id = generateMeetingId(input.date, input.title);
		const meeting: Meeting = {
			version: 1,
			type: "meeting",
			id,
			title: input.title,
			date: input.date,
			time: input.time,
			durationMinutes: input.durationMinutes ?? 60,
			meetingType: input.meetingType,
			status: "topic_pending",
			attendees: input.attendees ?? [],
			topics: input.topics ?? [],
			resources: [],
			minutes: null,
			analysis: null,
			createdAt: now,
			updatedAt: now,
		};
		await this.repo.save(meeting);
		eventBus.emit("meeting:created", { meetingId: id });
		return meeting;
	}

	/**
	 * PO-5 회의록 첨부.
	 *
	 * 책임:
	 *   - 호출자가 미리 만든 analysis 와 함께 회의에 합쳐 Repository 저장
	 *   - "minutes:attached" 이벤트 발행
	 *
	 * 분석 자체는 호출자(MinutesUploadModal)가 demoMode 분기로
	 *   - 시뮬레이터 (시연용 휴리스틱)
	 *   - agentService.analyzeMinutes (실서비스 LLM)
	 * 중 골라 수행 후 결과를 전달.
	 */
	async attachMinutes(input: AttachMinutesInput): Promise<MeetingAnalysis> {
		const meeting = await this.repo.getById(input.meetingId);
		if (!meeting) throw new Error(`회의 ${input.meetingId} 를 찾을 수 없습니다`);

		const updated: Meeting = {
			...meeting,
			minutes: {
				authorName: input.authorName,
				writtenAt: new Date().toISOString(),
				content: input.content,
			},
			analysis: input.analysis,
			status: "completed",
			updatedAt: new Date().toISOString(),
		};
		await this.repo.save(updated);
		eventBus.emit("minutes:attached", { meetingId: input.meetingId });
		return input.analysis;
	}

	/**
	 * PO-3 자료 자동 수집 결과 회의에 누적 저장.
	 *
	 * 호출자 (MeetingPageItemView) 가 agentService.collectResources 로 받은
	 * CollectedResource[] 를 MeetingResource[] 로 변환해 전달.
	 * 기존 resources 와 sourceUrl 중복은 자동 제거.
	 * "meeting:updated" 이벤트 1회 발행.
	 */
	async appendResources(
		meetingId: string,
		incoming: Array<{
			topicId: string | null;
			title: string;
			summary: string;
			sourceUrl: string;
		}>,
	): Promise<MeetingResource[]> {
		const meeting = await this.repo.getById(meetingId);
		if (!meeting) throw new Error(`회의 ${meetingId} 를 찾을 수 없습니다`);

		const existingUrls = new Set(meeting.resources.map((r) => r.sourceUrl));
		const now = new Date().toISOString();
		const rnd = () => Math.random().toString(36).slice(2, 8);

		const added: MeetingResource[] = incoming
			.filter((r) => r.title && r.sourceUrl && !existingUrls.has(r.sourceUrl))
			.map((r) => ({
				id: `res-${Date.now()}-${rnd()}`,
				topicId: r.topicId,
				title: r.title,
				summary: r.summary,
				sourceUrl: r.sourceUrl,
				collectedAt: now,
			}));

		if (added.length === 0) return [];

		await this.repo.save({
			...meeting,
			resources: [...meeting.resources, ...added],
			updatedAt: now,
		});
		eventBus.emit("meeting:updated", { meetingId });
		return added;
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

	/**
	 * 회의 vault 파일이 없으면 생성.
	 * MeetingPageItemView에서 네이티브 에디터로 열기 전 호출.
	 * 빈 파일 대신 올바른 frontmatter를 포함한 파일을 생성해 파싱 에러를 방지.
	 */
	async ensureVaultFile(data: {
		id: string;
		title: string;
		date: string;
		time: string;
		durationMinutes: number;
		type: "regular" | "adhoc";
		status: string;
		attendees: Meeting["attendees"];
		topics: Meeting["topics"];
		resources: Meeting["resources"];
	}): Promise<void> {
		const existing = await this.repo.getById(data.id);
		if (existing) return;
		const now = new Date().toISOString();
		const meeting: Meeting = {
			version: 1,
			type: "meeting",
			id: data.id,
			title: data.title,
			date: data.date,
			time: data.time,
			durationMinutes: data.durationMinutes,
			meetingType: data.type,
			status: data.status as Meeting["status"],
			attendees: data.attendees,
			topics: data.topics,
			resources: data.resources,
			minutes: null,
			analysis: null,
			createdAt: now,
			updatedAt: now,
		};
		await this.repo.save(meeting);
	}
}

/** "mtg-2026-05-25-ui-review-a1b2" 형태의 id 생성. */
function generateMeetingId(date: string, title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^\w가-힣\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-")
		.slice(0, 30);
	const rnd = Math.random().toString(36).slice(2, 6);
	return `mtg-${date}-${slug || rnd}-${rnd}`;
}
