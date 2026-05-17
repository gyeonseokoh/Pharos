/**
 * Agent 기능 I/O 계약 타입 모음.
 *
 * 각 기능의 입력(Input)과 출력(Result) 인터페이스를 정의.
 * 비즈니스 로직·OpenAI 호출은 agentService.ts 에 위치.
 */

// ─── Feature 3: 진행 상황 분석 (Progress Analysis) ───

export interface ProgressAnalysisInput {
	/** 분석 기준일 ISO date. 미지정 시 오늘. */
	asOf?: string;
	/** blocked Task 상세 포함 여부. 기본 true. */
	includeBlocked?: boolean;
	/** 팀원별 분석 포함 여부. 기본 true. */
	includeMemberDetails?: boolean;
}

export interface ProgressInsight {
	/** milestone=마일스톤 달성, risk=위험, achievement=성과, recommendation=권고 */
	type: "milestone" | "risk" | "achievement" | "recommendation";
	message: string;
	/** 관련 Task ID 목록 (선택). */
	relatedTaskIds?: string[];
}

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

export interface ProgressAnalysisResult {
	/** 분석 기준일 ISO date. */
	asOf: string;
	/** on-track=순조, at-risk=위험, critical=심각 */
	overallHealth: "on-track" | "at-risk" | "critical";
	/** Task 상태 기준 완료율 0~100. (done Task / 전체 Task) */
	completionRate: number;
	/**
	 * PM-3 체크리스트 항목 완료율 0~100.
	 * 전체 Task에 체크리스트 항목이 하나도 없으면 null.
	 */
	checklistCompletionRate: number | null;
	/**
	 * PM-4 커밋 검증 완료(verified) Task 수.
	 * linkedCommits에 verified 커밋이 하나라도 있는 Task 기준.
	 */
	verifiedTaskCount: number;
	insights: ProgressInsight[];
	blockedTasks: Array<{ id: string; title: string }>;
	memberHighlights: MemberHighlight[];
	/** AI가 생성한 전체 진행 상황 요약. */
	summary: string;
}
