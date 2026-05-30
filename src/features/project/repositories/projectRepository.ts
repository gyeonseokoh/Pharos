/**
 * ProjectRepository — Project 엔티티 데이터 접근 인터페이스.
 *
 * Project는 한 Vault에 단일 인스턴스 → SingletonRepository 패턴 사용.
 *
 * 구현체:
 *   - SettingsProjectRepository (1단계, settings 기반, 현재 사용)
 *   - VaultProjectRepository    (2단계, project.md 기반, 미래)
 */

import type { Disposable } from "../../../shared/repo/types";
import type { Project } from "../domain/projectSchema";

export interface ProjectRepository {
	/** 현재 프로젝트 조회. 없으면 null (초기 상태). */
	get(): Promise<Project | null>;
	/** 프로젝트 저장. updatedAt 자동 갱신. */
	save(project: Project): Promise<void>;
	/** 프로젝트 삭제 (시연·테스트용 reset). */
	delete(): Promise<void>;
	/** 변경 구독. dispose()로 해제. */
	watch(callback: (project: Project | null) => void): Disposable;
}
