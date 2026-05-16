/**
 * TeamService — 팀원·초대 관련 비즈니스 로직 Facade.
 *
 * UI·백엔드·AI 에이전트가 모두 이 Service를 통해 팀원 조작.
 * 내부에서 Repository 호출 + 도메인 이벤트 발행.
 *
 * 사용:
 *   await teamService.invite({ email, permission });  // PO-9 초대 발송
 *   await teamService.setStatus("m1", "left");        // 팀원 이탈 처리
 *   const members = await teamService.listActive();
 */

import { eventBus } from "../../../shared/repo/eventBus";
import type {
	Invite,
	InviteInput,
	Member,
	MemberInput,
	MemberPermission,
	MemberStatus,
} from "../domain/teamSchema";
import type { InviteRepository, TeamRepository } from "../repositories/teamRepository";

export class TeamService {
	constructor(
		private readonly memberRepo: TeamRepository,
		private readonly inviteRepo: InviteRepository,
	) {}

	/** 전체 팀원 목록 (이탈·초대 포함). */
	async list(): Promise<Member[]> {
		return this.memberRepo.list();
	}

	/** 활성 팀원만 (status === "active"). */
	async listActive(): Promise<Member[]> {
		return this.memberRepo.listActive();
	}

	/** ID로 단일 팀원 조회. */
	async getById(id: string): Promise<Member | null> {
		return this.memberRepo.getById(id);
	}

	/**
	 * 팀원 직접 추가. (PO-9 초대 수락 후 처리 or 테스트용)
	 *
	 * 책임:
	 *   - Member 엔티티 구성 (status "active")
	 *   - 이메일 중복 확인
	 *   - Repository 저장
	 *   - "team:member-added" 이벤트 발행
	 */
	async addMember(input: MemberInput): Promise<Member> {
		const existing = await this.memberRepo.getByEmail(input.email);
		if (existing) throw new Error(`이미 등록된 이메일입니다: ${input.email}`);

		const now = new Date().toISOString();
		const member: Member = {
			version: 1,
			type: "team-member",
			id: `m-${Date.now()}`,
			name: input.name,
			email: input.email,
			role: input.role,
			permission: input.permission,
			techStacks: input.techStacks,
			status: "active",
			joinedAt: now,
			createdAt: now,
			updatedAt: now,
		};
		await this.memberRepo.save(member);
		eventBus.emit("team:member-added", { memberId: member.id });
		return member;
	}

	/**
	 * 팀원 초대 발송. (PO-9)
	 *
	 * 초대장 발송 → 수락 전까지 Invite 레코드 유지.
	 * 수락 시 addMember() 호출하여 Member로 전환.
	 */
	async invite(input: InviteInput): Promise<Invite> {
		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
		const invite: Invite = {
			version: 1,
			type: "invite",
			id: `inv-${Date.now()}`,
			email: input.email,
			permission: input.permission,
			invitedAt: now,
			expiresAt,
			createdAt: now,
			updatedAt: now,
		};
		await this.inviteRepo.save(invite);
		return invite;
	}

	/** 대기 중인 초대 목록 (만료 포함). */
	async listInvites(): Promise<Invite[]> {
		return this.inviteRepo.list();
	}

	/** 만료되지 않은 초대만. */
	async listActiveInvites(): Promise<Invite[]> {
		return this.inviteRepo.listActive();
	}

	/** 초대 취소. */
	async cancelInvite(inviteId: string): Promise<void> {
		await this.inviteRepo.delete(inviteId);
	}

	/**
	 * 팀원 상태 변경. (이탈 처리 등)
	 *
	 * - "left": 소프트 삭제. 담당 Task의 assigneeId는 유지.
	 * - "active": 복귀 처리.
	 */
	async setStatus(memberId: string, status: MemberStatus): Promise<void> {
		const member = await this.memberRepo.getById(memberId);
		if (!member) throw new Error(`팀원 ${memberId} 를 찾을 수 없습니다`);
		await this.memberRepo.save({ ...member, status });

		if (status === "left") {
			eventBus.emit("team:member-removed", { memberId });
		} else if (status === "active") {
			eventBus.emit("team:member-added", { memberId });
		}
	}

	/**
	 * 팀원 권한 변경. (PO-9 권한 관리)
	 */
	async updatePermission(memberId: string, permission: MemberPermission): Promise<void> {
		const member = await this.memberRepo.getById(memberId);
		if (!member) throw new Error(`팀원 ${memberId} 를 찾을 수 없습니다`);
		await this.memberRepo.save({ ...member, permission });
	}
}
