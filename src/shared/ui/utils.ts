import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui 관례의 className 병합 유틸.
 * 조건부 클래스 + Tailwind 충돌 해결을 한 번에 처리한다.
 *
 * 예: cn("px-2 py-1", isActive && "bg-accent", className)
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
