/**
 * 도메인 이벤트 버스.
 *
 * 기존 옵시디언 `pharos:state-changed` 단일 이벤트를
 * 도메인별 이벤트 (`project:created`, `meeting:updated` 등) 로 분리하기 위한 버스.
 *
 * Service 레이어가 이벤트 발행, View(ItemView)가 구독해서 부분 갱신.
 *
 * 사용:
 *   eventBus.emit("project:created", { project });
 *   const off = eventBus.on("project:created", (payload) => render());
 *   off.dispose();
 */

import type { Disposable } from "./types";

/**
 * 이벤트 이름 → payload 타입 매핑.
 *
 * 새 도메인 이벤트 추가 시 여기에 한 줄 추가.
 * Service·View 모두 같은 매핑을 참조하므로 타입 안전.
 */
export interface DomainEventMap {
	// ─── Project ───
	"project:created": { projectName: string };
	"project:updated": { projectName: string };
	"project:reset": Record<string, never>;

	// ─── Meeting ───
	"meeting:created": { meetingId: string };
	"meeting:updated": { meetingId: string };
	"meeting:deleted": { meetingId: string };
	"minutes:attached": { meetingId: string };

	// ─── Roadmap ───
	"roadmap:planning-generated": Record<string, never>;
	"roadmap:development-generated": Record<string, never>;
	"roadmap:development-deleted": Record<string, never>;

	// ─── Task ───
	"task:created": { taskId: string };
	"task:updated": { taskId: string };
	"task:checked": { taskId: string; checked: boolean };

	// ─── Team ───
	"team:member-added": { memberId: string };
	"team:member-removed": { memberId: string };

	// ─── Generic fallback ─── (점진 전환용)
	"state:changed": Record<string, never>;
}

export type DomainEventName = keyof DomainEventMap;

type Listener<K extends DomainEventName> = (payload: DomainEventMap[K]) => void;

/** 단순 메모리 이벤트 버스. 옵시디언 plugin 라이프사이클에 종속. */
export class DomainEventBus {
	private listeners = new Map<DomainEventName, Set<Listener<DomainEventName>>>();

	on<K extends DomainEventName>(
		event: K,
		listener: Listener<K>,
	): Disposable {
		const set =
			this.listeners.get(event) ?? new Set<Listener<DomainEventName>>();
		set.add(listener as Listener<DomainEventName>);
		this.listeners.set(event, set);

		return {
			dispose: () => {
				set.delete(listener as Listener<DomainEventName>);
			},
		};
	}

	emit<K extends DomainEventName>(event: K, payload: DomainEventMap[K]): void {
		const set = this.listeners.get(event);
		if (!set) return;
		for (const listener of set) {
			try {
				(listener as Listener<K>)(payload);
			} catch (err) {
				console.error(`[Pharos] eventBus listener error (${event}):`, err);
			}
		}
	}

	/** 플러그인 unload 시 정리. */
	clear(): void {
		this.listeners.clear();
	}
}

/**
 * 전역 싱글턴 버스.
 *
 * main.ts 에서 만들어 PharosPluginLike 에 주입하는 게 더 깨끗하지만,
 * 점진 전환용으로 모듈 싱글턴 사용. 나중에 DI로 옮길 수 있음.
 */
export const eventBus = new DomainEventBus();
