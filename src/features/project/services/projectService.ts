/**
 * ProjectService — Project 관련 비즈니스 로직 Facade.
 *
 * UI·백엔드·AI 에이전트가 모두 이 Service를 통해 Project 조작.
 * 내부에서 Repository 호출 + 도메인 이벤트 발행.
 *
 * 사용:
 *   await projectService.create({ name, deadline, ... });
 *   const project = await projectService.get();
 *   await projectService.markPlanningGenerated();
 *   await projectService.reset();
 */

import { eventBus } from "../../../shared/repo/eventBus";
import type { Project, ProjectInput } from "../domain/projectSchema";
import type { ProjectRepository } from "../repositories/projectRepository";

const PROJECT_ID = "proj-pharos";

export class ProjectService {
	constructor(private readonly repo: ProjectRepository) {}

	/** 현재 프로젝트 조회. */
	async get(): Promise<Project | null> {
		return this.repo.get();
	}

	/**
	 * 새 프로젝트 생성. (PO-0)
	 *
	 * 책임:
	 *   - 입력값으로 Project 엔티티 구성
	 *   - 로드맵 플래그 초기화
	 *   - Repository 저장
	 *   - "project:created" 이벤트 발행
	 */
	async create(input: ProjectInput): Promise<Project> {
		const now = new Date().toISOString();
		const project: Project = {
			version: 1,
			type: "project",
			id: PROJECT_ID,
			name: input.name,
			description: input.description,
			deadline: input.deadline,
			fixedMeetingMode: input.fixedMeetingMode,
			fixedMeetingDay: input.fixedMeetingDay,
			fixedMeetingTime: input.fixedMeetingTime,
			planningRoadmapGenerated: false,
			developmentRoadmapGenerated: false,
			createdAt: now,
			updatedAt: now,
		};
		await this.repo.save(project);
		eventBus.emit("project:created", { projectName: project.name });
		return project;
	}

	/**
	 * 프로젝트 정보 수정. (PO-0 설정 수정)
	 * 로드맵 플래그·createdAt 은 유지.
	 */
	async update(input: Pick<ProjectInput, "name" | "description" | "deadline">): Promise<void> {
		const project = await this.repo.get();
		if (!project) throw new Error("프로젝트가 없습니다");
		await this.repo.save({
			...project,
			name: input.name,
			description: input.description,
			deadline: input.deadline,
			updatedAt: new Date().toISOString(),
		});
		eventBus.emit("project:created", { projectName: input.name });
	}

	/** 기획 로드맵 생성 완료 표시. (PO-1) */
	async markPlanningGenerated(): Promise<void> {
		const project = await this.repo.get();
		if (!project) throw new Error("프로젝트가 없습니다");
		await this.repo.save({ ...project, planningRoadmapGenerated: true });
		eventBus.emit("roadmap:planning-generated", {});
	}

	/** 개발 로드맵 생성 완료 표시. (PO-6) */
	async markDevelopmentGenerated(): Promise<void> {
		const project = await this.repo.get();
		if (!project) throw new Error("프로젝트가 없습니다");
		await this.repo.save({ ...project, developmentRoadmapGenerated: true });
		eventBus.emit("roadmap:development-generated", {});
	}

	/** 개발 로드맵 삭제 (시연용). 플래그만 false 로. */
	async markDevelopmentDeleted(): Promise<void> {
		const project = await this.repo.get();
		if (!project) return;
		await this.repo.save({
			...project,
			developmentRoadmapGenerated: false,
		});
		eventBus.emit("roadmap:development-deleted", {});
	}

	/** 프로젝트 전체 리셋 (시연·테스트용). */
	async reset(): Promise<void> {
		await this.repo.delete();
		eventBus.emit("project:reset", {});
	}
}