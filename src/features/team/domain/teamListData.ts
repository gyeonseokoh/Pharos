/**
 * 팀원 목록 뷰 (PO-9 팀 동기화/권한 관리) 데이터 타입.
 */

export type MemberRole = "PO" | "PM";
export type MemberPermission = "ADMIN" | "WRITE" | "READ";

export interface TeamMember {
	id: string;
	name: string;
	email: string;
	role: MemberRole;
	permission: MemberPermission;
	/** 기술 스택 배열. */
	techStacks: string[];
	/** 활성 상태. false 면 비활성(이탈 처리). */
	isActive: boolean;
	/** 가입 시각 ISO datetime. */
	joinedAt: string;
	/** PM-1 when2meet 입력 완료 여부. */
	hasFilledAvailability: boolean;
}

export interface TeamListData {
	/** 현재 로그인한 사용자 ID (본인 표시용). */
	currentUserId: string;
	members: TeamMember[];
	/** 대기 중인 초대 (발송됐지만 아직 수락 안 된 것). */
	pendingInvites: PendingInvite[];
}

export interface PendingInvite {
	id: string;
	/** 초대받은 이메일 (있는 경우). */
	email: string | null;
	permission: MemberPermission;
	/** 발송 시각. */
	invitedAt: string;
	/** 만료 시각 (24시간 후). */
	expiresAt: string;
}
