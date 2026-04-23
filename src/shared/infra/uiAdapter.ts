/**
 * UiAdapter — UI 상호작용을 추상화하는 레이어.
 *
 * feature domain 레이어는 이 인터페이스를 통해서만 "뷰 열기 / 파일 열기 / 알림"을
 * 수행한다. Obsidian의 App, Workspace, TFile 같은 타입이 domain으로
 * 새어나가지 않게 하는 게 목적.
 *
 * 각 feature의 ui 레이어 컴포넌트는 이 어댑터를 경유하지 않고
 * Obsidian API를 직접 사용해도 된다. 제약은 domain 에만 적용된다.
 */

import { App, TFile } from "obsidian";
import type { Notifier } from "./notifier";

export interface UiAdapter {
	/** 새 탭으로 커스텀 뷰를 연다. viewType은 플러그인이 registerView로 등록한 ID. */
	openView(viewType: string): Promise<void>;

	/** 새 탭으로 Vault 내 파일을 연다. 파일이 없으면 false 반환. */
	openFile(path: string): Promise<boolean>;

	/** 노트 내부의 특정 앵커(헤딩/블록 ID)로 이동. */
	openFileAtAnchor(path: string, anchor: string): Promise<boolean>;

	/** 단순 알림을 노출한다. Notifier.notify와 같은 효과. */
	notify(message: string): void;
}

/**
 * Obsidian의 Workspace·Vault API로 UiAdapter를 구현하는 MVP 버전.
 *
 * 나중에 독립 앱으로 포팅할 때는 WebUiAdapter(라우팅 라이브러리 기반) 를
 * 새로 만들어 교체한다. feature domain 코드는 수정 불필요.
 */
export class ObsidianUiAdapter implements UiAdapter {
	constructor(
		private readonly app: App,
		private readonly notifier: Notifier,
	) {}

	async openView(viewType: string): Promise<void> {
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type: viewType, active: true });
	}

	async openFile(path: string): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return false;
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.openFile(file);
		return true;
	}

	async openFileAtAnchor(path: string, anchor: string): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return false;
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.openFile(file, { eState: { subpath: `#${anchor}` } });
		return true;
	}

	notify(message: string): void {
		this.notifier.notify(message);
	}
}
