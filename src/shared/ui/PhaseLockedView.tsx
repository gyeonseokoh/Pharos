/**
 * PhaseLockedView — 현재 프로젝트 단계가 해당 뷰의 요구 단계에 못 미칠 때 공통 안내 화면.
 *
 * 예) "내 업무" / "진행도 확인" 은 개발 단계 진입 후 활성화 → 기획·setup 단계에서 진입 시
 *      개발 로드맵 생성 필요 안내 + Roadmap 탭으로 점프.
 */

import { Lock } from "lucide-react";
import { Button } from "./Button";

export interface PhaseLockedViewProps {
	/** 이 뷰 이름 (예: "내 업무", "진행도 확인"). */
	viewName: string;
	/** 잠금 사유 (예: "개발 로드맵 생성 후 이용 가능"). */
	reason: string;
	/** 안내 부가 설명 (예: "Roadmap 탭에서 '개발 로드맵 생성'을 진행해주세요."). */
	hint?: string;
	/** "로드맵으로 이동" 버튼 핸들러. */
	onOpenRoadmap?: () => void;
	/** "Dashboard로 이동" 버튼 핸들러. */
	onOpenDashboard?: () => void;
}

export function PhaseLockedView({
	viewName,
	reason,
	hint,
	onOpenRoadmap,
	onOpenDashboard,
}: PhaseLockedViewProps) {
	return (
		<div className="pharos-root flex min-h-full w-full items-center justify-center bg-bg-primary p-6">
			<div className="max-w-md text-center">
				<Lock className="mx-auto h-12 w-12 text-text-faint" />
				<h2 className="mt-4 text-lg font-bold text-text-normal">
					{viewName} — 잠김
				</h2>
				<p className="mt-2 text-sm text-text-muted">{reason}</p>
				{hint && (
					<p className="mt-1 text-xs text-text-faint">{hint}</p>
				)}
				<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
					{onOpenRoadmap && (
						<Button onClick={onOpenRoadmap}>📊 로드맵으로 이동</Button>
					)}
					{onOpenDashboard && (
						<Button variant="outline" onClick={onOpenDashboard}>
							🏠 Dashboard로 이동
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
