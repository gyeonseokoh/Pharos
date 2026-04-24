/**
 * WeeklyAvailabilityModal — PM-2 주간 가용시간 입력.
 * 매주 토요일 09시 알림에서 호출.
 */

import { useMemo, useState } from "react";
import { App, Notice } from "obsidian";
import { BaseReactModal, FormField, ModalLayout } from "shared/ui";
import { When2MeetGrid } from "./When2MeetGrid";

function Content({ onClose }: { onClose: () => void }) {
	const [slots, setSlots] = useState<Set<string>>(new Set());

	const weekLabel = useMemo(() => {
		const today = new Date();
		const sunday = new Date(today);
		sunday.setDate(today.getDate() - today.getDay());
		const saturday = new Date(sunday);
		saturday.setDate(sunday.getDate() + 6);
		const fmt = (d: Date) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		return `${fmt(sunday)} ~ ${fmt(saturday)}`;
	}, []);

	return (
		<ModalLayout
			title="📅 주간 가용시간"
			description={`이번 주 (${weekLabel}) 에 임시 회의 가능한 시간을 선택하세요`}
			submitLabel="저장"
			submitDisabled={slots.size === 0}
			onSubmit={() => {
				new Notice(`[미구현] 이번 주 가용시간 ${slots.size}칸 저장 예정`);
				onClose();
			}}
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
	renderContent() {
		return <Content onClose={() => this.close()} />;
	}
}
