/**
 * RoadmapService — 로드맵 관련 비즈니스 로직 Facade.
 *
 * UI·백엔드·AI 에이전트가 모두 이 Service를 통해 로드맵 조작.
 * 내부에서 Repository 호출 + ProjectService 연동 + 도메인 이벤트 발행.
 *
 * 사용:
 *   await roadmapService.savePlanning(input);   // PO-1 기획 로드맵 승인
 *   await roadmapService.saveDevelopment(input); // PO-6 개발 로드맵 승인
 *   const roadmap = await roadmapService.getDevelopment();
 */

import { eventBus } from "../../../shared/repo/eventBus";
import type { Roadmap, RoadmapInput } from "../domain/roadmapSchema";
import type { RoadmapRepository } from "../repositories/roadmapRepository";

export class RoadmapService {
	constructor(private readonly repo: RoadmapRepository) {}

	/** 기획 로드맵 조회. (PO-1 이전이면 null) */
	async getPlanning(): Promise<Roadmap | null> {
		return this.repo.getPlanning();
	}

	/** 개발 로드맵 조회. (PO-6 이전이면 null) */
	async getDevelopment(): Promise<Roadmap | null> {
		return this.repo.getDevelopment();
	}

	/**
	 * 기획 로드맵 저장. (PO-1 AI 생성 후 PO 승인)
	 *
	 * 책임:
	 *   - 엔티티 구성 (id, version, generatedAt 등 자동 설정)
	 *   - Repository 저장
	 *   - "roadmap:planning-generated" 이벤트 발행
	 */
	async savePlanning(input: RoadmapInput): Promise<Roadmap> {
		const now = new Date().toISOString();
		const roadmap: Roadmap = {
			version: 1,
			type: "roadmap",
			id: "roadmap-planning",
			roadmapKind: "planning",
			phases: input.phases.map((p) => ({
				...p,
				activities: p.activities ?? [],
			})),
			generatedAt: now,
			createdAt: now,
			updatedAt: now,
		};
		await this.repo.savePlanning(roadmap);
		eventBus.emit("roadmap:planning-generated", {});
		return roadmap;
	}

	/**
	 * 개발 로드맵 저장. (PO-6 AI 생성 후 PO 승인)
	 *
	 * 책임:
	 *   - 엔티티 구성
	 *   - Repository 저장
	 *   - "roadmap:development-generated" 이벤트 발행
	 */
	async saveDevelopment(input: RoadmapInput): Promise<Roadmap> {
		const now = new Date().toISOString();
		const roadmap: Roadmap = {
			version: 1,
			type: "roadmap",
			id: "roadmap-development",
			roadmapKind: "development",
			phases: input.phases.map((p) => ({
				...p,
				activities: p.activities ?? [],
			})),
			generatedAt: now,
			createdAt: now,
			updatedAt: now,
		};
		await this.repo.saveDevelopment(roadmap);
		eventBus.emit("roadmap:development-generated", {});
		return roadmap;
	}

	/**
	 * 개발 로드맵 삭제. (재생성 or 시연 리셋용)
	 */
	async deleteDevelopment(): Promise<void> {
		await this.repo.deleteDevelopment();
		eventBus.emit("roadmap:development-deleted", {});
	}
}
