/**
 * Minutes Archive 목업: meetingPageMocks에서 회의록 있는 것만 추출.
 */

import { meetingPageMocks } from "./meetingPageMock";
import type {
	MinutesArchiveData,
	MinutesArchiveItem,
} from "../domain/minutesArchiveData";

export const mockMinutesArchiveData: MinutesArchiveData = {
	items: Object.values(meetingPageMocks)
		.filter((m) => m.minutes !== null)
		.map(
			(m): MinutesArchiveItem => ({
				meetingId: m.id,
				meetingTitle: m.title,
				meetingDate: m.date,
				meetingType: m.type,
				authorName: m.minutes!.authorName,
				writtenAt: m.minutes!.writtenAt,
				preview: m.minutes!.content.slice(0, 200),
				aiSummary: m.analysis?.summary ?? null,
				length: m.minutes!.content.length,
			}),
		)
		// 최신 회의부터
		.sort((a, b) => b.meetingDate.localeCompare(a.meetingDate)),
};
