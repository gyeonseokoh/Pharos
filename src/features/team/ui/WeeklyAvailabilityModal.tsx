/**
 * WeeklyAvailabilityModal — PM-2 주간 가용시간 입력.
 * 매주 토요일 09시 알림에서 호출.
 *
 * docs/architecture/repository-design.md §4.6:
 *   weekStart = 해당 주 월요일 ISO date.
 */

import { useMemo, useState } from "react";
import { App, Notice } from "obsidian";
import { BaseReactModal, FormField, ModalLayout } from "shared/ui";
import { When2MeetGrid } from "./When2MeetGrid";
import type { PharosPluginLike } from "../../../app/settings";
import type { MemberSlotInput } from "../../availability/services/availabilityService";

export interface WeeklyAvailabilityModalArgs {
	plugin: PharosPluginLike;
	/** 현재 로그인 팀원 ID. */
	memberId: string;
}

/** When2MeetGrid 셀 키("day-slotIndex") → MemberSlotInput[] 변환. */
function slotsToMemberSlotInputs(selected: Set<string>): MemberSlotInput[] {
	return [...selected].map((key) => {
		const [dayStr, siStr] = key.split("-");
		const day = Number(dayStr);
		const si = Number(siStr);
		const pad = (n: number) => String(n).padStart(2, "0");
		const startH = Math.floor(si / 2);
		const startM = (si % 2) * 30;
		const endSi = si + 1;
		const endH = Math.floor(endSi / 2);
		const endM = (endSi % 2) * 30;
		return {
			day,
			start: `${pad(startH)}:${pad(startM)}`,
			end: `${pad(endH)}:${pad(endM)}`,
		};
	});
}

function Content({
	args,
	onClose,
}: {
	args: WeeklyAvailabilityModalArgs;
	onClose: () => void;
}) {
	const [slots, setSlots] = useState<Set<string>>(new Set());
	const [saving, setSaving] = useState(false);

	// §4.6: weekStart = 해당 주 월요일 ISO date
	const { weekStart, weekLabel } = useMemo(() => {
		const today = new Date();
		const dayOfWeek = today.getDay(); // 0=일, 1=월 ... 6=토
		const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
		const monday = new Date(today);
		monday.setDate(today.getDate() + daysToMonday);
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		const fmt = (d: Date) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		return { weekStart: fmt(monday), weekLabel: `${fmt(monday)} ~ ${fmt(sunday)}` };
	}, []);

	const handleSubmit = async () => {
		setSaving(true);
		try {
			const memberSlots = slotsToMemberSlotInputs(slots);
			await args.plugin.availabilityService.saveMemberSlots(
				weekStart,
				args.memberId,
				memberSlots,
			);
			new Notice("가용시간이 저장되었습니다");
			onClose();
		} catch (err) {
			new Notice(`저장 실패: ${String(err)}`);
		} finally {
			setSaving(false);
		}
	};

	return (
		<ModalLayout
			title="📅 주간 가용시간"
			description={`이번 주 (${weekLabel}) 에 임시 회의 가능한 시간을 선택하세요`}
			submitLabel={saving ? "저장 중…" : "저장"}
			submitDisabled={slots.size === 0 || saving}
			onSubmit={() => void handleSubmit()}
			onCancel={onClose}
			widthClass="max-w-xl"
		>
			<FormField
				label="가용 시간"
				hint="드래그로 선택. PO가 임시 회의 잡을 때 참고합니다."
			>
				<When2MeetGrid
					selected={slots}
					onChange={setSlots}
					days={[0, 1, 2, 3, 4, 5, 6]}
				/>
			</FormField>
		</ModalLayout>
	);
}

export class WeeklyAvailabilityModal extends BaseReactModal {
	constructor(
		app: App,
		private readonly args: WeeklyAvailabilityModalArgs,
	) {
		super(app);
	}

	renderContent() {
		return <Content args={this.args} onClose={() => this.close()} />;
	}
}
