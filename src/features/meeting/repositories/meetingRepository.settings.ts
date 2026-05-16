/**
 * SettingsMeetingRepository — 1단계 구현체.
 *
 * 데이터 소스 2개를 합쳐 Meeting 엔티티 통일 모델로 노출:
 *   1. meetingPageMocks (정적 mock 회의들)
 *   2. settings.attachedMinutes (사용자가 업로드한 회의록 + 분석)
 *
 * 회의 자체는 mock 에만 정의되어 있어 신규 회의 생성은 미지원 (다음 phase에서 Vault 기반 시 가능).
 * save/delete는 attachedMinutes 갱신·제거로 동작.
 */

import type { PharosPluginLike } from "../../../app/settings";
import type { ChangeEvent, Disposable } from "../../../shared/repo/types";
import { withUpdatedMeta } from "../../../shared/repo/types";
import type {
	Meeting,
	MeetingCategory,
	MeetingFilter,
	MeetingStatus,
} from "../domain/meetingSchema";
import {
	applyAttachedMinutes,
	getMeetingPageMock,
	listMeetingsWithoutMinutes,
	meetingPageMocks,
} from "../ui/meetingPageMock";
import type { MeetingPageData } from "../domain/meetingPageData";
import type { MeetingRepository } from "./meetingRepository";

export class SettingsMeetingRepository implements MeetingRepository {
	private listeners = new Set<(event: ChangeEvent<Meeting>) => void>();

	constructor(private readonly plugin: PharosPluginLike) {
		// settings 변경 시 listener에 "updated" 이벤트 (특정 ID 식별 어려우므로 generic)
		plugin.registerEvent(
			plugin.app.workspace.on("pharos:state-changed" as never, () => {
				void this.notifyAll();
			}),
		);
	}

	async list(filter?: MeetingFilter): Promise<Meeting[]> {
		const all = Object.values(meetingPageMocks).map((m) =>
			this.toEntity(applyAttachedMinutes(m, this.plugin.settings.attachedMinutes)),
		);
		return this.applyFilter(all, filter);
	}

	async getById(id: string): Promise<Meeting | null> {
		const mock = getMeetingPageMock(id);
		if (!mock) return null;
		const merged = applyAttachedMinutes(mock, this.plugin.settings.attachedMinutes);
		return this.toEntity(merged);
	}

	async save(meeting: Meeting): Promise<void> {
		const next = withUpdatedMeta(meeting);
		// 현재 단계: minutes·analysis만 settings.attachedMinutes 에 저장.
		// 다른 필드 변경(topics·resources 등)은 mock 정의이므로 v1에선 지원 X.
		if (next.minutes && next.analysis) {
			this.plugin.settings.attachedMinutes = {
				...this.plugin.settings.attachedMinutes,
				[next.id]: {
					minutes: {
						content: next.minutes.content,
						authorName: next.minutes.authorName,
						writtenAt: next.minutes.writtenAt,
					},
					analysis: next.analysis,
				},
			};
			await this.plugin.saveSettings();
		}
	}

	async delete(id: string): Promise<void> {
		const { [id]: _removed, ...rest } = this.plugin.settings.attachedMinutes;
		this.plugin.settings.attachedMinutes = rest;
		await this.plugin.saveSettings();
	}

	async listMeetingsWithoutMinutes(): Promise<Meeting[]> {
		const candidates = listMeetingsWithoutMinutes(
			this.plugin.settings.attachedMinutes,
		);
		return candidates.map((m) => this.toEntity(m));
	}

	async listByCategory(category: MeetingCategory): Promise<Meeting[]> {
		const all = await this.list();
		return all.filter((m) => m.analysis?.categories?.includes(category));
	}

	async listByStatus(status: MeetingStatus): Promise<Meeting[]> {
		return this.list({ status });
	}

	watch(callback: (event: ChangeEvent<Meeting>) => void): Disposable {
		this.listeners.add(callback);
		return {
			dispose: () => {
				this.listeners.delete(callback);
			},
		};
	}

	// ─────────────────────── internals ───────────────────────

	private async notifyAll(): Promise<void> {
		// 정확한 id별 변경 추적 어려움 → 모든 회의에 generic "updated" 통지
		const all = await this.list();
		for (const meeting of all) {
			for (const listener of this.listeners) {
				try {
					listener({ kind: "updated", entity: meeting, before: meeting });
				} catch (err) {
					console.error("[Pharos] MeetingRepository listener error:", err);
				}
			}
		}
	}

	/** mock 모델(MeetingPageData) → 정식 Entity(Meeting) 변환. */
	private toEntity(data: MeetingPageData): Meeting {
		const now = new Date().toISOString();
		return {
			version: 1,
			type: "meeting",
			id: data.id,
			title: data.title,
			date: data.date,
			time: data.time,
			durationMinutes: data.durationMinutes,
			meetingType: data.type,
			status: data.status,
			attendees: data.attendees,
			topics: data.topics.map((t) => ({
				id: t.id,
				title: t.title,
				description: t.description,
				priority: t.priority,
				source: t.source,
				reason: t.reason,
			})),
			resources: data.resources,
			minutes: data.minutes
				? {
						authorName: data.minutes.authorName,
						writtenAt: data.minutes.writtenAt,
						content: data.minutes.content,
					}
				: null,
			analysis: data.analysis,
			createdAt: data.minutes?.writtenAt ?? now,
			updatedAt: data.analysis?.analyzedAt ?? data.minutes?.writtenAt ?? now,
		};
	}

	private applyFilter(all: Meeting[], filter?: MeetingFilter): Meeting[] {
		if (!filter) return all;
		return all.filter((m) => {
			if (filter.status && m.status !== filter.status) return false;
			if (filter.meetingType && m.meetingType !== filter.meetingType) return false;
			if (filter.category && !m.analysis?.categories?.includes(filter.category))
				return false;
			if (filter.dateFrom && m.date < filter.dateFrom) return false;
			if (filter.dateTo && m.date > filter.dateTo) return false;
			return true;
		});
	}
}
