/**
 * TeamRepository / InviteRepository — 팀원·초대 엔티티 데이터 접근 인터페이스.
 *
 * docs/architecture/repository-design.md 5.2절 기준.
 *
 * 구현체:
 *   - SettingsTeamRepository     (1단계, data.json 기반, 현재 사용)
 *   - VaultTeamRepository        (2단계, Pharos/Team/*.md 기반)
 *   - HocuspocusTeamRepository   (3단계, 백엔드 실시간 동기화) ← 백엔드 연결 지점
 */

import type { ChangeEvent, Disposable } from "../../../shared/repo/types";
import type { Invite, Member, MemberPermission, MemberStatus } from "../domain/teamSchema";

export interface TeamRepository {
	/** 전체 팀원 목록 (이탈·초대 포함). */
	list(): Promise<Member[]>;
	/** 활성 팀원만 (status === "active"). */
	listActive(): Promise<Member[]>;
	/** ID로 단일 팀원 조회. */
	getById(id: string): Promise<Member | null>;
	/** 이메일로 팀원 조회. 초대 수락 시 중복 확인용. */
	getByEmail(email: string): Promise<Member | null>;
	/** 팀원 저장 (신규·갱신). updatedAt 자동 갱신. */
	save(member: Member): Promise<void>;
	/** 팀원 삭제. */
	delete(id: string): Promise<void>;
	/** 팀원 상태 변경 (active / left / invited). */
	setStatus(id: string, status: MemberStatus): Promise<void>;
	/** 변경 구독. dispose()로 해제. */
	watch(callback: (event: ChangeEvent<Member>) => void): Disposable;
}

export interface InviteRepository {
	/** 대기 중인 초대 목록 (만료 포함). */
	list(): Promise<Invite[]>;
	/** 만료되지 않은 초대만 조회. */
	listActive(): Promise<Invite[]>;
	/** ID로 단일 초대 조회. */
	getById(id: string): Promise<Invite | null>;
	/** 초대 저장 (신규·갱신). */
	save(invite: Invite): Promise<void>;
	/** 초대 삭제 (수락·거절·만료 처리 후). */
	delete(id: string): Promise<void>;
	/** 권한별 초대 목록. */
	listByPermission(permission: MemberPermission): Promise<Invite[]>;
	/** 변경 구독. dispose()로 해제. */
	watch(callback: (event: ChangeEvent<Invite>) => void): Disposable;
}
