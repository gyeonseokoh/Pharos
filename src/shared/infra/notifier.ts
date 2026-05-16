/**
 * Notifier — 사용자에게 짧은 알림을 보여주는 추상화 레이어.
 *
 * 각 feature의 domain 레이어는 이 인터페이스만 의존한다.
 * Obsidian Notice를 직접 호출하면 나중에 독립 앱으로 옮길 때 전부 다시 써야 한다.
 */

import { Notice } from "obsidian";

export interface Notifier {
	/** 일반 알림 (짧게 표시). */
	notify(message: string): void;

	/** 경고 — 주의가 필요한 상황. */
	warn(message: string): void;

	/** 에러 — 사용자가 행동해야 하는 실패. 더 오래 표시됨. */
	error(message: string): void;
}

/**
 * Obsidian Notice를 사용하는 MVP 구현.
 *
 * 웹/Electron으로 옮길 때는 WebNotifier(toast 라이브러리 사용 등) 를 새로 만들고
 * DI 컨테이너에서 주입 대상만 바꾸면 된다. 나머지 코드는 무변경.
 */
export class ObsidianNotifier implements Notifier {
	private static readonly WARN_DURATION_MS = 6000;
	private static readonly ERROR_DURATION_MS = 10000;

	notify(message: string): void {
		new Notice(message);
	}

	warn(message: string): void {
		new Notice(`⚠️ ${message}`, ObsidianNotifier.WARN_DURATION_MS);
	}

	error(message: string): void {
		new Notice(`❌ ${message}`, ObsidianNotifier.ERROR_DURATION_MS);
	}
}
