/**
 * RoadmapEmptyView — projectReport 없을 때 Roadmap 탭이 보여주는 빈 상태.
 */

import { ProjectRequiredEmpty } from "shared/ui";

export interface RoadmapEmptyViewProps {
	onBackToDashboard?: () => void;
}

export function RoadmapEmptyView({ onBackToDashboard }: RoadmapEmptyViewProps) {
	return (
		<ProjectRequiredEmpty viewName="로드맵" onOpenDashboard={onBackToDashboard} />
	);
}
