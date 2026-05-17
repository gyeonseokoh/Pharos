/**
 * Agent 기능 I/O 계약 타입 모음.
 *
 * 각 기능의 입력(Input)과 출력(Result) 인터페이스를 정의.
 * 비즈니스 로직·OpenAI/Tavily 호출은 agentService.ts 에 위치.
 */

// ─── Feature 4: 자료 조사 (Resource Collection, PO-3) ───

export interface ResourceCollectionInput {
	/** 자료를 수집할 회의 ID. */
	meetingId: string;
	/**
	 * 수집 대상 주제 목록. 미지정 시 meetingId로 조회한 Meeting.topics 사용.
	 * PO-2에서 확정된 주제를 직접 전달할 때 사용.
	 */
	topics?: Array<{ id: string; title: string; description?: string }>;
	/** Tavily 쿼리당 최대 결과 수. 기본 5. */
	maxResultsPerQuery?: number;
}

export interface CollectedResource {
	/** 수집 출처 주제 ID. */
	topicId: string;
	/** 자료 제목 (Tavily 반환값). */
	title: string;
	/** LLM이 생성한 한국어 요약본. 요약 실패 시 원문 앞 500자. */
	summary: string;
	/** 원본 URL (Tavily 반환값). */
	sourceUrl: string;
}

export interface ResourceCollectionResult {
	meetingId: string;
	/** 수집·요약 완료된 자료 목록. */
	resources: CollectedResource[];
	/** 수집된 총 자료 수. */
	totalCollected: number;
	/** 수집에 실패한 주제 ID 목록 (Tavily 3회 재시도 후 실패). */
	failedTopics: string[];
}
