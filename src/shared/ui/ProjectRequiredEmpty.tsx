/**
 * ProjectRequiredEmpty — 프로젝트가 아직 생성되지 않았을 때 모든 뷰가 공통으로 표시하는 empty state.
 *
 * 사용자가 NewProjectModal로 보고서 제출 전에는 데이터가 없으니,
 * 각 뷰(Calendar, MeetingsList 등)가 이 화면을 대신 렌더.
 */

import { FileQuestion } from "lucide-react";
import { Button } from "./Button";

export interface ProjectRequiredEmptyProps {
	/** "Dashboard로 이동" 버튼 핸들러. 제공 안 하면 버튼 숨김. */
	onOpenDashboard?: () => void;
	/** 이 뷰 이름 (예: "로드맵", "회의 목록"). hint 문구에 삽입. */
	viewName?: string;
}

export function ProjectRequiredEmpty({
	onOpenDashboard,
	viewName,
}: ProjectRequiredEmptyProps) {
	return (
		<div className="pharos-root flex min-h-full w-full items-center justify-center bg-bg-primary p-6">
			<div className="max-w-md text-center">
				<FileQuestion className="mx-auto h-12 w-12 text-text-faint" />
				<h2 className="mt-4 text-lg font-bold text-text-normal">
					프로젝트가 아직 없습니다
				</h2>
				<p className="mt-2 text-sm text-text-muted">
					{viewName
						? `${viewName}은 프로젝트 생성 후 이용할 수 있습니다.`
						: "Dashboard에서 프로젝트 보고서를 먼저 작성해주세요."}
				</p>
				{onOpenDashboard && (
					<div className="mt-6">
						<Button onClick={onOpenDashboard}>🏠 Dashboard로 이동</Button>
					</div>
				)}
			</div>
		</div>
	);
}
