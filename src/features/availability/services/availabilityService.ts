/**
 * AvailabilityService — 가용시간 관련 비즈니스 로직 Facade.
 *
 * UI·백엔드·AI 에이전트가 모두 이 Service를 통해 가용시간 조작.
 *
 * 사용:
 *   // PM-1 / PM-2: 팀원 본인의 주차별 가용시간 저장
 *   await availabilityService.saveMemberSlots("2026-05-04", "m1", [
 *     { day: 1, start: "14:00", end: "16:00" },
 *   ]);
 *
 *   // PO-4: 특정 주차 전체 팀원 공통 슬롯 조회
 *   const common = await availabilityService.findCommonSlots("2026-05-04");
 */

import type { Availability, AvailabilitySlot } from "../domain/availabilitySchema";
import type { AvailabilityRepository } from "../repositories/availabilityRepository";

/** memberId 없이 팀원이 본인 슬롯을 입력할 때 쓰는 타입. */
export interface MemberSlotInput {
	day: number;  // 0=일 ~ 6=토
	start: string; // "HH:MM"
	end: string;   // "HH:MM"
}

export class AvailabilityService {
	constructor(private readonly repo: AvailabilityRepository) {}

	/**
	 * 특정 주차 가용시간 조회. (PO-4 임시 회의 일정 추천용)
	 * weekStart: 해당 주 월요일 ISO date (예: "2026-05-04").
	 */
	async getByWeek(weekStart: string): Promise<Availability | null> {
		return this.repo.getByWeek(weekStart);
	}

	/**
	 * 특정 팀원의 모든 주차 가용시간 목록.
	 */
	async listByMember(memberId: string): Promise<Availability[]> {
		return this.repo.listByMember(memberId);
	}

	/**
	 * 팀원 본인의 주차별 가용시간 저장. (PM-1 초기 입력 / PM-2 주간 갱신)
	 *
	 * - 해당 주차의 기존 슬롯 중 이 팀원 것만 교체하고 나머지 팀원 슬롯은 보존.
	 * - weekStart: 해당 주 월요일 ISO date.
	 */
	async saveMemberSlots(
		weekStart: string,
		memberId: string,
		memberSlots: MemberSlotInput[],
	): Promise<void> {
		const existing = await this.repo.getByWeek(weekStart);

		// 이 팀원 슬롯 제거 후 새 슬롯 추가
		const otherSlots: AvailabilitySlot[] = (existing?.slots ?? []).filter(
			(s) => s.memberId !== memberId,
		);
		const newSlots: AvailabilitySlot[] = memberSlots.map((s) => ({
			memberId,
			day: s.day,
			start: s.start,
			end: s.end,
		}));

		await this.repo.saveSlots(weekStart, [...otherSlots, ...newSlots]);
	}

	/**
	 * 특정 주차의 전체 팀원 공통 가용 슬롯 조회. (PO-4 임시 회의 후보 시간 추천)
	 *
	 * 동일 day·start·end가 2명 이상의 슬롯에 있을 때 "공통"으로 판단.
	 * MVP 단순화: 정확한 시간 겹침 계산 대신 완전 일치 슬롯만 반환.
	 */
	async findCommonSlots(
		weekStart: string,
		minCount = 2,
	): Promise<MemberSlotInput[]> {
		const availability = await this.repo.getByWeek(weekStart);
		if (!availability || availability.slots.length === 0) return [];

		// day·start·end 조합별 참여 인원 카운트
		const countMap = new Map<string, number>();
		for (const slot of availability.slots) {
			const key = `${slot.day}|${slot.start}|${slot.end}`;
			countMap.set(key, (countMap.get(key) ?? 0) + 1);
		}

		const common: MemberSlotInput[] = [];
		for (const [key, count] of countMap) {
			if (count >= minCount) {
				const [day, start, end] = key.split("|") as [string, string, string];
				common.push({ day: Number(day), start, end });
			}
		}

		return common;
	}

	/**
	 * 특정 주차 가용시간 삭제.
	 */
	async deleteByWeek(weekStart: string): Promise<void> {
		await this.repo.deleteByWeek(weekStart);
	}
}
