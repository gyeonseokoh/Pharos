/**
 * LocalInviteService — 같은 컴퓨터 안에서 동작하는 시연용 구현.
 *
 * 시연 시나리오:
 *   1. PO 가 InviteMemberModal 에서 issueToken() 호출
 *   2. 우리가 UUID 토큰 발급 + InviteRepository (Vault) 에 저장
 *   3. 발급된 URL 을 클립보드 복사 / 보여주기
 *   4. 신규 팀원이 같은 컴퓨터에서 그 URL 클릭
 *   5. main.ts 의 protocol handler 가 verifyToken() 호출
 *   6. 유효하면 JoinProjectModal 띄움
 *   7. 가입 완료 시 consumeToken() 으로 토큰 소비 (일회용)
 *
 * 한계:
 *   - 다른 PC 로 토큰 전달 불가 (Vault 가 같은 PC 에 있어야 함)
 *   - 위 한계는 경석님 sync 모듈 합류 시 ServerInviteService 로 교체하면 해결
 */

import { eventBus } from "../../../shared/repo/eventBus";
import type { Invite } from "../domain/teamSchema";
import type { InviteRepository } from "../repositories/teamRepository";
import {
	buildInviteUrl,
	DEFAULT_INVITE_TTL_MS,
	type InviteService,
	type IssuedInvite,
	type IssueTokenInput,
	type VerifiedInvite,
} from "./inviteService";

export interface LocalInviteServiceDeps {
	inviteRepo: InviteRepository;
	/** 현재 프로젝트의 workspaceId (URL 에 포함). */
	getWorkspaceId: () => Promise<string | null>;
}

export class LocalInviteService implements InviteService {
	constructor(private readonly deps: LocalInviteServiceDeps) {}

	async issueToken(input: IssueTokenInput): Promise<IssuedInvite> {
		const workspaceId = (await this.deps.getWorkspaceId()) ?? "ws-local";
		const token = generateToken();
		const now = Date.now();
		const expiresAt = new Date(now + DEFAULT_INVITE_TTL_MS).toISOString();
		const inviteUrl = buildInviteUrl(token, workspaceId);

		const invite: Invite = {
			version: 1,
			type: "invite",
			id: token, // 토큰 자체를 ID로 — verifyToken에서 getById 한 번에 조회
			email: input.email ?? null,
			permission: input.permission,
			invitedAt: new Date(now).toISOString(),
			expiresAt,
			createdAt: new Date(now).toISOString(),
			updatedAt: new Date(now).toISOString(),
		};
		await this.deps.inviteRepo.save(invite);

		return {
			token,
			expiresAt,
			inviteUrl,
			permission: input.permission,
		};
	}

	async verifyToken(token: string): Promise<VerifiedInvite | null> {
		const invite = await this.deps.inviteRepo.getById(token);
		if (!invite) return null;

		// 만료 체크
		if (Date.parse(invite.expiresAt) < Date.now()) {
			// 만료된 토큰은 정리
			await this.deps.inviteRepo.delete(token).catch(() => {});
			return null;
		}

		const workspaceId = (await this.deps.getWorkspaceId()) ?? "ws-local";
		return {
			token,
			permission: invite.permission,
			workspaceId,
			expiresAt: invite.expiresAt,
		};
	}

	async consumeToken(token: string): Promise<void> {
		// 일회용 — 가입 완료 시 즉시 삭제
		await this.deps.inviteRepo.delete(token);
	}

	async listPending(): Promise<IssuedInvite[]> {
		const all = await this.deps.inviteRepo.listActive();
		const workspaceId = (await this.deps.getWorkspaceId()) ?? "ws-local";
		return all.map((inv) => ({
			token: inv.id,
			expiresAt: inv.expiresAt,
			inviteUrl: buildInviteUrl(inv.id, workspaceId),
			permission: inv.permission,
		}));
	}

	async revokeToken(token: string): Promise<void> {
		await this.deps.inviteRepo.delete(token);
	}
}

/**
 * 토큰 생성 — 가능하면 crypto.randomUUID, 폴백은 timestamp + random.
 * 시연용이라 보안 수준은 충분. 진짜 서비스는 ServerInviteService가 서버에서 발급.
 */
function generateToken(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `inv-${crypto.randomUUID()}`;
	}
	const ts = Date.now().toString(36);
	const rnd = Math.random().toString(36).slice(2, 12);
	return `inv-${ts}-${rnd}`;
}
