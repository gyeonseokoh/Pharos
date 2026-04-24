/**
 * Topic Page 데이터 타입.
 *
 * 회의 1건 안의 주제 1건에 대한 전용 페이지.
 * 내용: 주제 본문 + AI 제안 이유 + 해당 주제 관련 자료 + 결정사항 + 회의록 발췌.
 */

import type { MeetingResource, MeetingTopic } from "./meetingPageData";

export interface TopicPageData {
	/** 상위 회의 정보 (breadcrumb용). */
	meeting: {
		id: string;
		title: string;
		date: string;
		time: string;
	};
	topic: MeetingTopic;
	/** 이 주제에 연결된 자료. */
	resources: MeetingResource[];
	/** 이 주제에 대해 내려진 결정사항. 회의 완료 전이면 비어있음. */
	decisions: string[];
	/** AI가 전체 회의록에서 이 주제 관련 부분만 발췌한 인용. 회의 전·분석 전이면 null. */
	minutesExcerpt: string | null;
}
