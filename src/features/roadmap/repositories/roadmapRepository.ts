/**
 * RoadmapRepository — Roadmap 엔티티 데이터 접근 인터페이스.
 *
 * docs/architecture/repository-design.md 5.2절 기준.
 * Roadmap은 kind 당 단일 인스턴스 (planning 1개, development 1개).
 * 개별 Task는 TaskRepository가 담당하며, Task.phase로 소속 로드맵을 구분한다.
 *
 * 구현체:
 *   - SettingsRoadmapRepository     (1단계, data.json 기반, 현재 사용)
 *   - VaultRoadmapRepository        (2단계, Pharos/Roadmap/*.md 기반)
 *   - HocuspocusRoadmapRepository   (3단계, 백엔드 실시간 동기화) ← 백엔드 연결 지점
 */

import type { Disposable } from "../../../shared/repo/types";
import type { Roadmap } from "../domain/roadmapSchema";

export interface RoadmapRepository {
	/** 기획 로드맵 조회. 없으면 null (PO-1 실행 전). */
	getPlanning(): Promise<Roadmap | null>;
	/** 개발 로드맵 조회. 없으면 null (PO-6 실행 전). */
	getDevelopment(): Promise<Roadmap | null>;
	/** 기획 로드맵 저장 (신규·갱신). updatedAt 자동 갱신. */
	savePlanning(roadmap: Roadmap): Promise<void>;
	/** 개발 로드맵 저장 (신규·갱신). updatedAt 자동 갱신. */
	saveDevelopment(roadmap: Roadmap): Promise<void>;
	/** 개발 로드맵 삭제 (재생성 시). */
	deleteDevelopment(): Promise<void>;
	/** 변경 구독. kind 로 어떤 로드맵이 바뀌었는지 전달. dispose()로 해제. */
	watch(callback: (kind: "planning" | "development") => void): Disposable;
}
