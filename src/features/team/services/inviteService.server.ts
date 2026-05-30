/**
 * ServerInviteService — 백엔드 합류 시 사용할 구현체 (현재는 스텁).
 *
 * 회의 합의(2026-05-17):
 *   - 옵시디언 안쪽 (UI·protocol handler) 은 유석 영역
 *   - 서버 측 토큰 발급·검증·메일·다른 PC 로 전달은 경석 영역
 *
 * 경석님이 합류해서 채울 부분:
 *   1. baseUrl + 인증 헤더 (워크스페이스 secret 또는 PO 토큰)
 *   2. POST /invites          — issueToken 구현
 *   3. GET  /invites/:token   — verifyToken 구현
 *   4. POST /invites/:token/consume — consumeToken 구현
 *   5. GET  /invites?status=active  — listPending
 *   6. DELETE /invites/:token  — revokeToken
 *
 * 메일 발송은 백엔드에서 POST /invites 시 자동으로 트리거 (input.email 이 있을 때).
 *
 * 사용 (백엔드 합류 시 main.ts 한 줄만 교체):
 *   // 시연용 (현재)
 *   this.inviteService = new LocalInviteService({ inviteRepo, getWorkspaceId });
 *
 *   // 백엔드 통합 시
 *   this.inviteService = new ServerInviteService({
 *     baseUrl: settings.hocuspocusServerUrl,
 *     getAuthToken: () => settings.apiToken,  // 또는 OAuth 토큰
 *     getWorkspaceId,
 *   });
 *
 * UI · protocol handler 코드는 일체 수정 없음 (InviteService 인터페이스만 알면 됨).
 */

import type {
	InviteService,
	IssuedInvite,
	IssueTokenInput,
	VerifiedInvite,
} from "./inviteService";

export interface ServerInviteServiceDeps {
	/** 서버 base URL. settings.hocuspocusServerUrl 등에서. */
	baseUrl: string;
	/** 인증 토큰 (Bearer). PO 토큰 또는 워크스페이스 secret. */
	getAuthToken: () => string | null;
	/** 현재 프로젝트 workspaceId. */
	getWorkspaceId: () => Promise<string | null>;
}

export class ServerInviteService implements InviteService {
	constructor(private readonly deps: ServerInviteServiceDeps) {}

	async issueToken(input: IssueTokenInput): Promise<IssuedInvite> {
		// TODO(경석): POST {baseUrl}/invites
		// body: { workspaceId, permission, email }
		// auth: Authorization: Bearer {getAuthToken()}
		// response: { token, expiresAt, inviteUrl }
		throw new Error(
			"ServerInviteService.issueToken 미구현 — 경석님이 백엔드 합류 시 채울 부분",
		);
	}

	async verifyToken(token: string): Promise<VerifiedInvite | null> {
		// TODO(경석): GET {baseUrl}/invites/{token}
		// response (200): { token, permission, workspaceId, expiresAt }
		// response (404/410): null 반환 (무효·만료)
		throw new Error(
			"ServerInviteService.verifyToken 미구현 — 경석님이 백엔드 합류 시 채울 부분",
		);
	}

	async consumeToken(token: string): Promise<void> {
		// TODO(경석): POST {baseUrl}/invites/{token}/consume
		// 서버가 일회용 처리 + 신규 팀원 정보를 PO 워크스페이스에 등록
		throw new Error(
			"ServerInviteService.consumeToken 미구현 — 경석님이 백엔드 합류 시 채울 부분",
		);
	}

	async listPending(): Promise<IssuedInvite[]> {
		// TODO(경석): GET {baseUrl}/invites?status=active&workspaceId=...
		throw new Error(
			"ServerInviteService.listPending 미구현 — 경석님이 백엔드 합류 시 채울 부분",
		);
	}

	async revokeToken(token: string): Promise<void> {
		// TODO(경석): DELETE {baseUrl}/invites/{token}
		throw new Error(
			"ServerInviteService.revokeToken 미구현 — 경석님이 백엔드 합류 시 채울 부분",
		);
	}
}
