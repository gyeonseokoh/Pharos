/**
 * EmptyDashboardView — projectReport가 아직 없는 초기 상태의 Dashboard.
 *
 * Pharos 플러그인 첫 실행 (또는 Reset Project 후) 사용자가 보는 화면.
 * "프로젝트 생성" CTA 하나만 노출.
 */

import { FolderOpen, Sparkles } from "lucide-react";
import { Button } from "shared/ui/Button";

export interface EmptyDashboardViewProps {
	/** 🆕 새 프로젝트 버튼 핸들러 (NewProjectModal 열기). */
	onCreateProject: () => void;
}

export function EmptyDashboardView({ onCreateProject }: EmptyDashboardViewProps) {
	return (
		<div className="pharos-root flex min-h-full w-full items-center justify-center bg-bg-primary p-6">
			<div className="max-w-lg text-center">
				<div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--interactive-accent)]/10">
					<FolderOpen className="h-10 w-10 text-[color:var(--interactive-accent)]" />
					<Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-[color:var(--interactive-accent)]" />
				</div>

				<p className="text-xs uppercase tracking-wide text-text-faint">
					Pharos Dashboard
				</p>
				<h1 className="mt-2 text-2xl font-bold text-text-normal">
					프로젝트가 아직 없습니다
				</h1>
				<p className="mt-3 text-sm leading-relaxed text-text-muted">
					Pharos를 시작하려면 먼저 프로젝트 보고서를 작성해주세요.
					<br />
					주제·마감·고정 회의 정보를 입력하면 팀 협업 환경이 준비됩니다.
				</p>

				<div className="mt-8">
					<Button onClick={onCreateProject} size="lg">
						🆕 새 프로젝트 만들기
					</Button>
				</div>

				<p className="mt-6 text-[11px] text-text-faint">
					나중에 명령 팔레트(<span className="font-mono">Ctrl/Cmd+P</span>)
					에서 <span className="font-mono">Pharos: Reset Project</span> 로 초기화할 수 있어요.
				</p>
			</div>
		</div>
	);
}
