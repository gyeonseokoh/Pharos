/**
 * ServerInviteService
 * 초대용 API 엔드포인트와 통신하는 실구현체.
 *
 * main.ts 에서 LocalInviteService 대신 이 클래스를 주입하면
 * 시연 모드 → 실서버 모드로 전환됨. UI·protocol handler 코드 수정 없음.
 */

import type {
	InviteService,
	IssuedInvite,
	IssueTokenInput,
	VerifiedInvite,
} from "./inviteService";
import type { MemberPermission } from "../domain/teamSchema";

export interface ServerInviteServiceDeps {
	/** 서버 base URL (e.g. https://pharos-backend-5eew.onrender.com). */
	baseUrl: () => string;
	/** 인증 토큰 getter — 항상 최신 JWT 반환. */
	getAuthToken: () => string | null;
	/** 현재 settings.workspaceId getter. */
	getWorkspaceId: () => Promise<number | null>;
}

export class ServerInviteService implements InviteService {
	constructor(private readonly deps: ServerInviteServiceDeps) {}

	/** Authorization 헤더 객체 생성. */
	private authHeader(): Record<string, string> {
		const token = this.deps.getAuthToken();
		return token ? { Authorization: `Bearer ${token}` } : {};
	}

	/** fetch wrapper — 4xx/5xx를 Error로 변환. */
	private async request<T>(
		path: string,
		init: RequestInit = {},
	): Promise<T> {
		const res = await fetch(`${this.deps.baseUrl()}${path}`, {
			...init,
			headers: {
				"Content-Type": "application/json",
				...this.authHeader(),
				...(init.headers as Record<string, string> ?? {}),
			},
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`[ServerInviteService] ${init.method ?? "GET"} ${path} → ${res.status}: ${body}`);
		}
		if (res.status === 204) return undefined as T;
		return res.json() as Promise<T>;
	}

	// ── POST /invites ─────────────────────────────────────────────
	async issueToken(input: IssueTokenInput): Promise<IssuedInvite> {
		const workspaceId = await this.deps.getWorkspaceId();
		if (!workspaceId) throw new Error("워크스페이스 ID 없음 — 프로젝트를 먼저 생성하세요");

		const data = await this.request<{
			token:      string;
			expires_at: string;
			invite_url: string;
			permission: string;
		}>("/invites", {
			method: "POST",
			body: JSON.stringify({
				workspace_id: workspaceId,
				permission:   input.permission,
				email:        input.email,
			}),
		});

		return {
			token:      data.token,
			expiresAt:  data.expires_at,
			inviteUrl:  data.invite_url,
			permission: data.permission as MemberPermission,
		};
	}

	// ── GET /invites/:token ───────────────────────────────────────
	async verifyToken(token: string): Promise<VerifiedInvite | null> {
		// 예외는 호출자(handleJoinLink)로 전파 — null은 "만료·미존재", 예외는 "통신 오류"를 의미
		const res = await fetch(`${this.deps.baseUrl()}/invites/${encodeURIComponent(token)}`);
		if (res.status === 404 || res.status === 410) return null;
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const data = (await res.json()) as {
			token:        string;
			permission:   string;
			workspace_id: number;
			expires_at:   string;
		};
		return {
			token:       data.token,
			permission:  data.permission as MemberPermission,
			workspaceId: data.workspace_id,
			expiresAt:   data.expires_at,
		};
	}

	// ── POST /invites/:token/consume ──────────────────────────────
	async consumeToken(token: string): Promise<{ workspaceId: number }> {
		const data = await this.request<{ workspace_id: number }>(
			`/invites/${encodeURIComponent(token)}/consume`,
			{ method: "POST" },
		);
		return { workspaceId: data.workspace_id };
	}

	// ── GET /invites?workspace_id=N ───────────────────────────────
	async listPending(): Promise<IssuedInvite[]> {
		const workspaceId = await this.deps.getWorkspaceId();
		if (!workspaceId) return [];

		const data = await this.request<{ invites: IssuedInvite[] }>(
			`/invites?workspace_id=${workspaceId}`,
		);
		return data.invites;
	}

	// ── DELETE /invites/:token ────────────────────────────────────
	async revokeToken(token: string): Promise<void> {
		await this.request<void>(
			`/invites/${encodeURIComponent(token)}`,
			{ method: "DELETE" },
		);
	}
}