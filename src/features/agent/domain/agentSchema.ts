/**
 * Agent 기능 입출력 타입 계약(contract).
 *
 * 각 에이전트 기능의 Input / Result 타입을 이 파일에서 선언.
 * 도메인 로직 없음 — Service 레이어에서만 생성·소비.
 */

// ─── 7. 회의록 요약 ────────────────────────────────────────────────────────────

/** 회의록 요약 에이전트 입력. */
export interface MinutesSummaryInput {
	/**
	 * 요약할 회의 ID.
	 * 해당 회의에 minutes(회의록)가 첨부되어 있어야 함.
	 * Agent2 분석(analysis)이 있으면 추가 컨텍스트로 활용.
	 */
	meetingId: string;
}

/** 회의에서 도출된 단일 액션 아이템. */
export interface MinutesSummaryActionItem {
	/** 담당자 이름. 불명확하면 "팀 전체". */
	assignee: string;
	/** 수행할 작업 내용 (한국어). */
	task: string;
}

/** 회의록 요약 에이전트 결과. */
export interface MinutesSummaryResult {
	meetingId: string;
	/** 2~3문장 전체 회의 요약 (한국어). */
	executiveSummary: string;
	/** 핵심 논의 포인트 3~7개 (한국어). */
	keyPoints: string[];
	/** 이 회의에서 확정된 결정사항 목록 (한국어). */
	decisions: string[];
	/** 회의에서 도출된 액션 아이템 목록. */
	actionItems: MinutesSummaryActionItem[];
	/**
	 * 다음 회의 주제 후보 3~5개 (한국어).
	 * PO-2 (회의 주제 자동 생성) 입력값으로 활용.
	 */
	suggestedTopics: string[];
}
