/**
 * RoadmapGenerateView — 로드맵이 아직 생성 안 된 상태의 "생성하기" 페이지.
 *
 * 기획 로드맵(PO-1) / 개발 로드맵(PO-6) 생성 CTA 공통 컴포넌트.
 * 버튼 누르면 상위 ItemView가 실제 생성 로직 (나중에 llmClient 호출)을 처리.
 */

import { Loader2, Sparkles } from "lucide-react";
import { BackNav, type BackNavItem, Button } from "shared/ui";

export interface RoadmapGenerateViewProps {
	kind: "planning" | "development";
	loading?: boolean;
	onGenerate: () => void;
	onBackToHome?: () => void;
}

export function RoadmapGenerateView({
	kind,
	loading,
	onGenerate,
	onBackToHome,
}: RoadmapGenerateViewProps) {
	const { title, subtitle, buttonLabel, description, loadingLabel } = COPY[kind];

	const navItems: BackNavItem[] = [];
	if (onBackToHome)
		navItems.push({ icon: "home", label: "홈으로", onClick: onBackToHome });

	return (
		<div className="pharos-root flex min-h-full w-full flex-col bg-bg-primary p-6">
			<div className="mx-auto w-full max-w-3xl">
				{navItems.length > 0 && <BackNav items={navItems} />}
			</div>
			<div className="flex flex-1 items-center justify-center">
				<div className="max-w-lg text-center">
					<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--interactive-accent)]/10">
						{loading ? (
							<Loader2 className="h-10 w-10 animate-spin text-[color:var(--interactive-accent)]" />
						) : (
							<Sparkles className="h-10 w-10 text-[color:var(--interactive-accent)]" />
						)}
					</div>

					<p className="text-xs uppercase tracking-wide text-text-faint">
						Pharos Roadmap
					</p>
					<h1 className="mt-2 text-2xl font-bold text-text-normal">{title}</h1>
					<p className="mt-3 text-sm leading-relaxed text-text-muted">
						{loading ? loadingLabel : subtitle}
					</p>

					<div className="mt-8">
						<Button onClick={onGenerate} size="lg" disabled={loading}>
							{loading ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									생성 중...
								</>
							) : (
								<>
									<Sparkles className="h-4 w-4" />
									{buttonLabel}
								</>
							)}
						</Button>
					</div>

					<p className="mt-6 text-[11px] text-text-faint">{description}</p>
				</div>
			</div>
		</div>
	);
}

const COPY = {
	planning: {
		title: "기획 로드맵이 아직 없습니다",
		subtitle:
			"프로젝트 보고서를 기반으로 AI가 기획 주간 로드맵을 생성합니다. 요구사항 정의 · 기술 스택 선정 · 프로토타입 스펙까지의 흐름을 간트로 정리해드립니다.",
		buttonLabel: "AI 기획 로드맵 생성하기",
		loadingLabel: "AI가 보고서를 분석하고 있습니다... 잠시만 기다려주세요.",
		description:
			"현재는 목업으로 시뮬레이션됩니다. 추후 OpenAI 연동 후 실제 생성으로 교체됩니다.",
	},
	development: {
		title: "개발 로드맵이 아직 없습니다",
		subtitle:
			"기획 주간이 끝나면 AI가 팀원 기술 스택 기반으로 개발 업무를 자동 할당합니다.",
		buttonLabel: "개발 단계로 전환하기",
		loadingLabel: "AI가 개발 로드맵을 생성하고 있습니다...",
		description: "기획 로드맵은 개발 주간에도 참고용으로 남아있습니다.",
	},
} as const;
