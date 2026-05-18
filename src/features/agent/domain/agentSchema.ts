/**
 * Agent 기능 입출력 타입 계약(contract).
 *
 * 각 에이전트 기능의 Input / Result 타입을 이 파일에서 선언.
 * 도메인 로직 없음 — Service 레이어에서만 생성·소비.
 */

// ─── 6. 업무 세분화 & 할당 ────────────────────────────────────────────────────

/** 업무 세분화 에이전트 입력. */
export interface TaskBreakdownInput {
	/** 세분화 대상 Task ID (TASK-XXX 형식). */
	taskId: string;
	/** Task 제목. LLM 프롬프트 핵심 입력. */
	taskTitle: string;
	/** Task 설명 (선택). 추가 맥락 제공. */
	taskDescription?: string;
	/** 기술 요구사항 (선택). 예: ["Java", "Spring Boot"]. */
	techStack?: string[];
}

/** AI가 제안한 단일 체크리스트 항목. */
export interface ChecklistSuggestion {
	/** 세부 작업 텍스트 (한국어). */
	text: string;
	/** AI가 이 항목을 제안한 이유 (한국어). */
	reason: string;
}

/** 업무 세분화 에이전트 결과. */
export interface TaskBreakdownResult {
	taskId: string;
	/** 생성된 체크리스트 항목 목록 (5~7개). */
	items: ChecklistSuggestion[];
	/** AI가 작성한 세분화 요약 (한국어). */
	summary: string;
}
