/**
 * ModalLayout — Modal 내부 공통 레이아웃 (헤더 + 본문 + 푸터).
 */

import type { ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "./utils";

export interface ModalLayoutProps {
	title: string;
	description?: string;
	children: ReactNode;
	/** 제출 버튼 라벨. 없으면 버튼 숨김. */
	submitLabel?: string;
	onSubmit?: () => void;
	submitDisabled?: boolean;
	cancelLabel?: string;
	onCancel?: () => void;
	/** 최대 너비 (Tailwind 클래스). 기본 max-w-lg. */
	widthClass?: string;
}

export function ModalLayout({
	title,
	description,
	children,
	submitLabel,
	onSubmit,
	submitDisabled,
	cancelLabel = "취소",
	onCancel,
	widthClass = "max-w-lg",
}: ModalLayoutProps) {
	return (
		<div className={cn("mx-auto w-full", widthClass)}>
			<header className="mb-4 border-b border-bg-modifier pb-3">
				<h2 className="text-lg font-bold text-text-normal">{title}</h2>
				{description && (
					<p className="mt-0.5 text-xs text-text-muted">{description}</p>
				)}
			</header>

			<div className="max-h-[60vh] overflow-y-auto">{children}</div>

			{(submitLabel || onCancel) && (
				<footer className="mt-4 flex justify-end gap-2 border-t border-bg-modifier pt-3">
					{onCancel && (
						<Button variant="ghost" onClick={onCancel}>
							{cancelLabel}
						</Button>
					)}
					{submitLabel && onSubmit && (
						<Button onClick={onSubmit} disabled={submitDisabled}>
							{submitLabel}
						</Button>
					)}
				</footer>
			)}
		</div>
	);
}

/**
 * Form 입력 필드 레이아웃 헬퍼.
 */
export function FormField({
	label,
	required,
	hint,
	children,
}: {
	label: string;
	required?: boolean;
	hint?: string;
	children: ReactNode;
}) {
	return (
		<div className="mb-4">
			<label className="mb-1 block text-xs font-medium text-text-muted">
				{label}
				{required && <span className="ml-1 text-[color:var(--color-red)]">*</span>}
			</label>
			{children}
			{hint && <p className="mt-1 text-[11px] text-text-faint">{hint}</p>}
		</div>
	);
}

/** 일반 텍스트 input 스타일. */
export const inputClass =
	"w-full rounded-md border border-bg-modifier bg-bg-secondary px-3 py-2 text-sm text-text-normal placeholder:text-text-faint focus:border-[color:var(--interactive-accent)] focus:outline-none";

/** textarea 스타일. */
export const textareaClass = inputClass + " resize-none";
