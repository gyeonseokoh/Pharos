/**
 * MeetingsService — 회의·회의록·분석 관련 비즈니스 로직 Facade.
 *
 * UI·백엔드·AI 에이전트가 모두 이 Service를 통해 회의 조작.
 * 내부에서 Repository + 분석 시뮬레이터(또는 LLM) 호출 + 도메인 이벤트 발행.
 */

import { eventBus } from "../../../shared/repo/eventBus";
import type {
	AttachMinutesInput,
	Meeting,
	MeetingAnalysis,
	MeetingCategory,
	MeetingFilter,
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

	/** 회의록 삭제 (시연·테스트용). 회의 자체는 유지, attachedMinutes만 제거. */
	async detachMinutes(meetingId: string): Promise<void> {
		await this.repo.delete(meetingId);
		eventBus.emit("meeting:updated", { meetingId });
	}
}
