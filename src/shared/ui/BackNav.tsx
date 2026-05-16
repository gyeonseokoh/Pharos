/**
 * BackNav — 페이지 상단 네비게이션 바.
 *
 * Obsidian은 탭 기반이지만 사용자 입장에서 "뒤로 / 홈으로" 버튼이 없으면
 * 길을 잃는다. 각 View 상단에 이 컴포넌트를 두면 통일된 네비게이션이 생긴다.
 *
 * 예:
 *   <BackNav
 *     items={[
 *       { icon: "calendar", label: "캘린더", onClick: onBackToCalendar },
 *       { icon: "home", label: "홈", onClick: onBackToHome },
 *     ]}
 *   />
 */

import { ArrowLeft, Calendar, Home, List, ListChecks } from "lucide-react";
import type { ReactElement } from "react";

type NavIcon = "back" | "calendar" | "home" | "list" | "myTasks";

export interface BackNavItem {
	icon: NavIcon;
	label: string;
	onClick: () => void;
}

export interface BackNavProps {
	items: BackNavItem[];
}

export function BackNav({ items }: BackNavProps) {
	if (items.length === 0) return null;
	return (
		<nav className="flex flex-wrap items-center gap-1.5 text-xs">
			{items.map((item, i) => (
				<BackNavButton key={i} item={item} />
			))}
		</nav>
	);
}

function BackNavButton({ item }: { item: BackNavItem }) {
	return (
		<div
			onClick={item.onClick}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					item.onClick();
				}
			}}
			className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-bg-modifier bg-bg-secondary px-2.5 py-1.5 text-text-muted transition-colors hover:border-[color:var(--interactive-accent)]/50 hover:bg-[color:var(--background-modifier-hover)] hover:text-text-normal"
		>
			{renderIcon(item.icon)}
			<span>{item.label}</span>
		</div>
	);
}

function renderIcon(icon: NavIcon): ReactElement {
	const cls = "h-3.5 w-3.5";
	switch (icon) {
		case "back":
			return <ArrowLeft className={cls} />;
		case "calendar":
			return <Calendar className={cls} />;
		case "home":
			return <Home className={cls} />;
		case "list":
			return <List className={cls} />;
		case "myTasks":
			return <ListChecks className={cls} />;
	}
}
