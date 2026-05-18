/**
 * Agent 기능 I/O 계약 타입 모음.
 *
 * 각 기능의 입력(Input)과 출력(Result) 인터페이스를 정의.
 * 비즈니스 로직·OpenAI 호출은 agentService.ts 에 위치.
 */

// ─── Feature 2: 회의록 분석 (Minutes Analysis, PO-5) ───

export interface MinutesAnalysisInput {
	/** 회의 ID — MeetingsService에서 존재 여부 확인. */
	meetingId: string;
	/** 회의록 원본 텍스트. 최소 50자 (PO-5 시나리오 2a). */
	minutesText: string;
}

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
