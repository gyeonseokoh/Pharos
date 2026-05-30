/**
 * Minutes Archive 데이터 빌더.
 *
 * mock 회의의 minutes + settings.attachedMinutes(업로드된 것)를 머지해
 * 시간 역순으로 정렬. settings를 파라미터로 받아 런타임 갱신.
 */

import { meetingPageMocks } from "./meetingPageMock";
import type { AttachedMinute } from "../../../app/settings";
import type {
	MinutesArchiveData,
	MinutesArchiveItem,
} from "../domain/minutesArchiveData";

function fromMockMeetings(): MinutesArchiveItem[] {
	return Object.values(meetingPageMocks)
		.filter((m) => m.minutes !== null)
		.map((m) => ({
			meetingId: m.id,
			meetingTitle: m.title,
			meetingDate: m.date,
			meetingType: m.type,
			authorName: m.minutes!.authorName,
			writtenAt: m.minutes!.writtenAt,
			preview: m.minutes!.content.slice(0, 200),
			aiSummary: m.analysis?.summary ?? null,
			length: m.minutes!.content.length,
			categories: m.analysis?.categories ?? [],
		}));
}

function fromAttached(
	attachedMinutes: Record<string, AttachedMinute>,
): MinutesArchiveItem[] {
	return Object.entries(attachedMinutes).flatMap(([meetingId, attached]) => {
		const m = meetingPageMocks[meetingId];
		if (!m) return [];
		return [
			{
				meetingId,
				meetingTitle: m.title,
				meetingDate: m.date,
				meetingType: m.type,
				authorName: attached.minutes.authorName,
				writtenAt: attached.minutes.writtenAt,
				preview: attached.minutes.content.slice(0, 200),
				aiSummary: attached.analysis.summary,
				length: attached.minutes.content.length,
				categories: attached.analysis.categories,
			},
		];
	});
}

/** settings.attachedMinutes를 반영한 최종 아카이브. */
export function buildMinutesArchiveData(
	attachedMinutes: Record<string, AttachedMinute>,
): MinutesArchiveData {
	const items = [...fromMockMeetings(), ...fromAttached(attachedMinutes)].sort(
		(a, b) => b.meetingDate.localeCompare(a.meetingDate),
	);
	return { items };
}
