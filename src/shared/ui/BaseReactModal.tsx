/**
 * BaseReactModal — React 컴포넌트를 Obsidian Modal 안에 렌더링하는 공통 베이스.
 *
 * 사용:
 * ```ts
 * class MyModal extends BaseReactModal {
 *   renderContent() {
 *     return <MyForm onSubmit={(v) => { this.close(); }} />;
 *   }
 * }
 * new MyModal(this.app).open();
 * ```
 */

import { App, Modal } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import type { ReactElement } from "react";

export abstract class BaseReactModal extends Modal {
	private root: Root | null = null;

	constructor(app: App) {
		super(app);
	}

	/** 하위 클래스가 구현. React element 반환. */
	abstract renderContent(): ReactElement;

	onOpen(): void {
		this.contentEl.empty();
		this.contentEl.addClass("pharos-root");
		this.modalEl.addClass("pharos-modal");
		this.root = createRoot(this.contentEl);
		this.root.render(this.renderContent());
	}

	onClose(): void {
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
	}
}
