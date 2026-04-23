/**
 * Roadmap에 필요한 데이터 타입 (view-model).
 *
 * 오늘: `ui/mock.ts`가 이 형태로 목업 제공.
 * 미래: `roadmapService`가 PO-1(기획 로드맵) / PO-6(개발 로드맵) 결과를 같은 형태로 반환.
 *
 * 순수 타입. UI/React 의존 없음. 아이콘은 문자열 식별자로 두고 UI에서 해석한다.
 */

export type TaskKind = "task" | "milestone";
export type TaskStatus = "done" | "in-progress" | "todo";

export interface RoadmapTask {
	id: string;
	name: string;
	kind: TaskKind;
	status: TaskStatus;
	/** ISO date. milestone이면 start === end. */
	start: string;
	end: string;
	/** 0~100. milestone이면 보통 0 또는 100. */
	progress: number;
	assignee?: string;
	/** 선행 작업 ID. */
	dependsOn?: string[];
}

/**
 * Flow 뷰에 쓰이는 아이콘 식별자.
 * UI에서 lucide-react 아이콘으로 매핑한다.
 */
export type PhaseIconName =
	| "compass"
	| "code"
	| "server"
	| "flask"
	| "rocket";

export interface RoadmapPhase {
	id: string;
	name: string;
	start: string;
	end: string;
	status: TaskStatus;
	activities: string[];
	icon: PhaseIconName;
	/** 화살표 블록의 메인 색상 (HEX). */
	color: string;
}

export interface RoadmapProjectInfo {
	name: string;
	start: string;
	end: string;
}

/**
 * RoadmapView가 받는 전체 데이터.
 */
export interface RoadmapData {
	project: RoadmapProjectInfo;
	phases: RoadmapPhase[];
	tasks: RoadmapTask[];
}
