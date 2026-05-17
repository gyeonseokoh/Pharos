/**
 * InviteService — 팀원 초대 토큰 발급·검증·소비.
 *
 * 회의 합의(2026-05-17):
 *   - "옵시디언 안쪽 동작" 은 유석 영역 (UI 연결 + 시연용 mock)
 *   - "서버 측 검증·메일·동기화" 는 경석 영역 (백엔드 통합 시)
 *
 * 이 파일은 **계약(인터페이스)** 만 정의.
 * 구현체:
 *   - LocalInviteService  (시연용. 같은 컴퓨터 안에서만 동작)
 *   - ServerInviteService (백엔드 합류 시. 경석 sync·인증 서버와 통신)
 *
 * main.ts 의 한 줄만 교체하면 시연 → 진짜 서비스 전환됨.
 */

import type { MemberPermission } from "../domain/teamSchema";

/**
 * 토큰 발급 입력.
 */
export interface IssueTokenInput {
	/** 부여할 권한 (READ/WRITE/ADMIN). */
	permission: MemberPermission;
	/** 옵셔널 이메일. 백엔드 통합 시 초대 메일 발송용. */
	email?: string;
}

/**
 * 토큰 발급 결과.
 */
export interface IssuedInvite {
	/** 일회용 토큰 (UUID 또는 서버 발급 문자열). */
	token: string;
	/** 만료 시각 ISO datetime (보통 24h 후). */
	expiresAt: string;
	/** 클릭 시 옵시디언이 자동 열리는 deep link. */
	inviteUrl: string;
	/** 권한 (verifyToken 결과와 동일). */
	permission: MemberPermission;
}

/**
 * 토큰 검증 결과. 유효한 토큰이면 invite 메타, 만료·미존재면 null.
 */
export interface VerifiedInvite {
	token: string;
	permission: MemberPermission;
	/** 어느 workspace 에 합류할지. 시연 시엔 로컬 workspaceId. */
	workspaceId: string;
	/** 만료 시각 (UI 표시용). */
	expiresAt: string;
}

/**
 * 초대 토큰 라이프사이클 관리 서비스.
 *
 * UI(InviteMemberModal·JoinProjectModal)·protocol handler 가 모두 이 인터페이스만 알면 됨.
 * 구현체 교체는 main.ts 의 의존성 주입 한 곳만.
 */
export interface InviteService {
	/**
	 * 새 초대 토큰 발급. PO가 InviteMemberModal에서 호출.
	 *
	 * 시연용 (Local): 메모리·Vault에 저장, UUID 발급.
	 * 백엔드 (Server): 서버 API 호출, 서버가 토큰 발급·DB 저장·메일 발송.
	 */
	issueToken(input: IssueTokenInput): Promise<IssuedInvite>;

	/**
	 * 토큰 검증. protocol handler 가 링크 받았을 때 호출.
	 *
	 * 유효: invite 메타 반환 (UI에서 JoinProjectModal 띄움)
	 * 무효 (만료·존재 X·이미 소비됨): null
	 */
	verifyToken(token: string): Promise<VerifiedInvite | null>;

	/**
	 * 토큰 소비 처리. JoinProjectModal 제출 직후 호출.
	 * 일회용 처리로 같은 링크로 두 번 가입 못하게 함.
	 */
	consumeToken(token: string): Promise<void>;

	/**
	 * 발급됐지만 아직 사용되지 않은 토큰 목록 (관리·디버깅용).
	 * Server 구현체는 PO의 권한 토큰으로 조회.
	 */
	listPending(): Promise<IssuedInvite[]>;

	/**
	 * 토큰 취소 (만료 전 강제 회수). PO 영역.
	 */
	revokeToken(token: string): Promise<void>;
}

/**
 * 초대 링크 생성 헬퍼. 구현체 무관하게 같은 URL 형식 사용.
 *
 * URL 형식: obsidian://pharos-join?token=<token>&workspace=<workspaceId>
 * 옵시디언이 OS 에 등록한 obsidian:// 스킴 → 우리 protocol handler 호출.
 */
export function buildInviteUrl(token: string, workspaceId: string): string {
	const t = encodeURIComponent(token);
	const w = encodeURIComponent(workspaceId);
	return `obsidian://pharos-join?token=${t}&workspace=${w}`;
}

/**
 * 초대 토큰 만료 기본값 (24시간).
 * 회의 합의(시나리오.md §7 PO-15): "24시간 만료 일회용 토큰".
 */
export const DEFAULT_INVITE_TTL_MS = 24 * 60 * 60 * 1000;
