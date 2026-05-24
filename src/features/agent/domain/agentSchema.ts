/**
 * Agent 기능 입출력 타입 계약(contract).
 *
 * 각 에이전트 기능의 Input / Result 타입을 이 파일에서 선언.
 * 도메인 로직 없음 — Service 레이어에서만 생성·소비.
 *
 * 기능 목록:
 *   1. coordinateSchedule  — 일정 조율
 *   2. analyzeMinutes      — 회의록 분석
 *   3. analyzeProgress     — 진행 상황 분석
 *   4. collectResources    — 자료 조사
 *   6. breakdownTask       — 업무 세분화·할당
 *   7. summarizeMinutes    — 회의록 요약 (의존: 2)
 */

// ─── 1. 일정 조율 ─────────────────────────────────────────────────────────────

/** 일정 조율 에이전트 입력. */
export interface ScheduleCoordinationInput {
	/** 조율할 주 월요일 ISO date (예: "2026-05-04"). */
	weekStart: string;
	/**
	 * 조율 대상 팀원 ID 목록.
	 * 생략 시 전체 활성 팀원 대상.
	 */
	participantIds?: string[];
	/** 공통 슬롯 인정 기준 최소 참여 인원 (기본 2). */
	minParticipants?: number;
	/** 원하는 회의 소요 시간(분). AI가 슬롯 필터링 시 참고. 기본 60. */
	meetingDurationMinutes?: number;
}

/** AI가 추천하는 단일 회의 후보 슬롯. */
export interface MeetingSlotRecommendation {
	/** 요일 (0=일 ~ 6=토). */
	day: number;
	/** 해당 요일의 ISO date (예: "2026-05-05"). */
	date: string;
	/** 시작 시간 "HH:MM". */
	start: string;
	/** 종료 시간 "HH:MM". */
	end: string;
	/** 해당 슬롯에 참여 가능한 팀원 이름 목록. */
	availableMembers: string[];
	/** AI가 이 슬롯을 추천하는 이유 (한국어). */
	reason: string;
}

/** 일정 조율 에이전트 결과. */
export interface ScheduleCoordinationResult {
	weekStart: string;
	/** 최대 3개 추천 슬롯. 공통 가용시간이 없으면 빈 배열. */
	recommendations: MeetingSlotRecommendation[];
	/** AI가 작성한 전체 일정 조율 결과 요약 (한국어). */
	summary: string;
}

// ─── 2. 회의록 분석 ───────────────────────────────────────────────────────────

/** 회의록 분석 에이전트 입력. */
export interface MinutesAnalysisInput {
	/** 회의 ID — MeetingsService에서 존재 여부 확인. */
	meetingId: string;
	/** 회의록 원본 텍스트. 최소 50자 (PO-5 시나리오 2a). */
	minutesText: string;
}

/** 회의록 분석 에이전트 결과. */
export interface MinutesAnalysisResult {
	meetingId: string;
	/**
	 * 핵심 키워드 목록.
	 * PO-5-BR-2: 최소 3개 보장 — AI 추출 후 부족하면 빈도 기반으로 보완.
	 */
	keywords: string[];
	/**
	 * 기술 스택 후보.
	 * PO-5-BR-3: 회의록에 명시된 기술만 포함. AI 추론 금지.
	 */
	techStacks: string[];
	/** 주요 결정사항 목록. */
	decisions: string[];
	/** 회의 핵심 내용 1~2문장 요약. */
	summary: string;
}

// ─── 3. 진행 상황 분석 ────────────────────────────────────────────────────────

/** 진행 상황 분석 에이전트 입력. */
export interface ProgressAnalysisInput {
	/** 분석 기준일 ISO date. 미지정 시 오늘. */
	asOf?: string;
	/** blocked Task 상세 포함 여부. 기본 true. */
	includeBlocked?: boolean;
	/** 팀원별 분석 포함 여부. 기본 true. */
	includeMemberDetails?: boolean;
}

/** AI가 생성한 단일 인사이트. */
export interface ProgressInsight {
	/** milestone=마일스톤 달성, risk=위험, achievement=성과, recommendation=권고 */
	type: "milestone" | "risk" | "achievement" | "recommendation";
	message: string;
	/** 관련 Task ID 목록 (선택). */
	relatedTaskIds?: string[];
}

/** 팀원별 진행 하이라이트. */
export interface MemberHighlight {
	memberId: string;
	memberName: string;
	/** Task 상태 기준 완료율 0~100. 실데이터 기반 (PO-12). */
	completionRate: number;
	/** PO-12 효성도 축: verified 커밋이 1개 이상 연결된 Task 수. */
	verifiedTaskCount: number;
	/** PO-12 완료체크 축: userChecked=true 인 Task 수. */
	userCheckedCount: number;
	/** AI가 생성한 팀원 현황 한 줄 요약. */
	highlight: string;
}

/** 진행 상황 분석 에이전트 결과. */
export interface ProgressAnalysisResult {
	/** 분석 기준일 ISO date. */
	asOf: string;
	/** on-track=순조, at-risk=위험, critical=심각 */
	overallHealth: "on-track" | "at-risk" | "critical";
	/** Task 상태 기준 완료율 0~100. */
	completionRate: number;
	/**
	 * PM-3 체크리스트 항목 완료율 0~100.
	 * 체크리스트 항목이 하나도 없으면 null.
	 */
	checklistCompletionRate: number | null;
	/** PM-4 커밋 검증 완료(verified) Task 수. */
	verifiedTaskCount: number;
	insights: ProgressInsight[];
	blockedTasks: Array<{ id: string; title: string }>;
	memberHighlights: MemberHighlight[];
	/** AI가 생성한 전체 진행 상황 요약. */
	summary: string;
}

// ─── 4. 자료 조사 ─────────────────────────────────────────────────────────────

/** 자료 조사 에이전트 입력. */
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

/** 수집된 단일 자료 항목. */
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

/** 자료 조사 에이전트 결과. */
export interface ResourceCollectionResult {
	meetingId: string;
	/** 수집·요약 완료된 자료 목록. */
	resources: CollectedResource[];
	/** 수집된 총 자료 수. */
	totalCollected: number;
	/** 수집에 실패한 주제 ID 목록 (Tavily 3회 재시도 후 실패). */
	failedTopics: string[];
}

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

// ─── 7. 회의록 요약 ───────────────────────────────────────────────────────────

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
