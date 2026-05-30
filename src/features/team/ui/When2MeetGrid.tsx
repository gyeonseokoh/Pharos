/**
 * When2MeetGrid — 드래그로 가용 시간대 선택하는 공통 그리드 컴포넌트.
 * PM-1 (초기 고정 가용시간) / PM-2 (주간 가용시간) 공용.
 */

import { useCallback, useState } from "react";
import { cn } from "shared/ui/utils";

export interface TimeSlot {
	/** 0=일 ~ 6=토. */
	day: number;
	/** 시간대 시작 시각 (30분 단위 인덱스, 0=0시, 48=24시). */
	slotIndex: number;
}

export interface When2MeetGridProps {
	/** 시작 시간 (정수, 시간 단위). 기본 9. */
	startHour?: number;
	/** 끝 시간 (exclusive). 기본 22. */
	endHour?: number;
	/** 현재 선택된 슬롯들. */
	selected: Set<string>;
	/** 선택 변경 콜백. */
	onChange: (selected: Set<string>) => void;
	/** 표시할 요일 (0=일, 6=토). 기본 [1..5] 월~금. */
	days?: number[];
}

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function When2MeetGrid({
	startHour = 9,
	endHour = 22,
	selected,
	onChange,
	days = [1, 2, 3, 4, 5],
}: When2MeetGridProps) {
	const [dragMode, setDragMode] = useState<"add" | "remove" | null>(null);

	// 30분 단위 슬롯
	const slots: number[] = [];
	for (let h = startHour; h < endHour; h++) {
		slots.push(h * 2);
		slots.push(h * 2 + 1);
	}

	const key = (day: number, slotIndex: number) => `${day}-${slotIndex}`;

	const toggle = useCallback(
		(day: number, slotIndex: number) => {
			const k = key(day, slotIndex);
			const next = new Set(selected);
			if (dragMode === "add") next.add(k);
			else if (dragMode === "remove") next.delete(k);
			else {
				if (next.has(k)) next.delete(k);
				else next.add(k);
			}
			onChange(next);
		},
		[dragMode, selected, onChange],
	);

	const handleMouseDown = (day: number, slotIndex: number) => {
		const k = key(day, slotIndex);
		const mode = selected.has(k) ? "remove" : "add";
		setDragMode(mode);
		const next = new Set(selected);
		if (mode === "add") next.add(k);
		else next.delete(k);
		onChange(next);
	};

	const handleMouseEnter = (day: number, slotIndex: number) => {
		if (!dragMode) return;
		const k = key(day, slotIndex);
		const next = new Set(selected);
		if (dragMode === "add") next.add(k);
		else next.delete(k);
		onChange(next);
	};

	const handleMouseUp = () => setDragMode(null);

	return (
		<div
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			className="select-none overflow-x-auto"
		>
			<table className="w-full border-collapse">
				<thead>
					<tr>
						<th className="w-12 text-[10px] font-normal text-text-faint"></th>
						{days.map((d) => (
							<th
								key={d}
								className={cn(
									"px-1 py-1 text-xs font-semibold",
									d === 0 && "text-[color:var(--color-red)]",
									d === 6 && "text-[color:var(--color-blue)]",
									d > 0 && d < 6 && "text-text-normal",
								)}
							>
								{DAY_LABELS[d]}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{slots.map((slotIdx) => {
						const isHourBoundary = slotIdx % 2 === 0;
						const hour = Math.floor(slotIdx / 2);
						return (
							<tr key={slotIdx}>
								<td
									className={cn(
										"pr-1 text-right align-top text-[10px] text-text-faint",
										isHourBoundary ? "font-medium" : "opacity-0",
									)}
								>
									{isHourBoundary ? `${hour}:00` : ""}
								</td>
								{days.map((d) => {
									const k = key(d, slotIdx);
									const isSelected = selected.has(k);
									return (
										<td
											key={d}
											onMouseDown={() => handleMouseDown(d, slotIdx)}
											onMouseEnter={() => handleMouseEnter(d, slotIdx)}
											className={cn(
												"h-4 cursor-pointer border border-bg-modifier transition-colors",
												isSelected
													? "bg-[color:var(--interactive-accent)]"
													: "bg-bg-secondary hover:bg-[color:var(--background-modifier-hover)]",
												isHourBoundary && "border-t-2 border-t-bg-modifier",
											)}
										/>
									);
								})}
							</tr>
						);
					})}
				</tbody>
			</table>

			<p className="mt-2 text-[11px] text-text-faint">
				드래그해서 가능 시간을 선택하세요.
			</p>
		</div>
	);
}
