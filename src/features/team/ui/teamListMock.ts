/**
 * 팀원 목록 목업 데이터.
 */

import type { TeamListData } from "../domain/teamListData";

export const mockTeamListData: TeamListData = {
	currentUserId: "m1",
	members: [
		{
			id: "m1",
			name: "유석",
			email: "yuseok@example.com",
			role: "PO",
			permission: "ADMIN",
			techStacks: ["React", "TypeScript", "Obsidian Plugin API"],
			isActive: true,
			joinedAt: "2026-04-01T09:00:00+09:00",
			hasFilledAvailability: true,
		},
		{
			id: "m2",
			name: "경석",
			email: "kyungseok@example.com",
			role: "PM",
			permission: "ADMIN",
			techStacks: ["Node.js", "Yjs", "Hocuspocus", "SQLite", "Oracle Cloud"],
			isActive: true,
			joinedAt: "2026-04-01T09:30:00+09:00",
			hasFilledAvailability: true,
		},
		{
			id: "m3",
			name: "수웅",
			email: "suwoong@example.com",
			role: "PM",
			permission: "WRITE",
			techStacks: ["Python", "OpenAI API", "LangChain", "Prompt Engineering"],
			isActive: true,
			joinedAt: "2026-04-01T10:00:00+09:00",
			hasFilledAvailability: true,
		},
		{
			id: "m4",
			name: "동환",
			email: "donghwan@example.com",
			role: "PM",
			permission: "WRITE",
			techStacks: ["GitHub API", "Data Analysis", "Python"],
			isActive: true,
			joinedAt: "2026-04-01T10:30:00+09:00",
			hasFilledAvailability: true,
		},
		{
			id: "m5",
			name: "우덕",
			email: "wooduck@example.com",
			role: "PM",
			permission: "WRITE",
			techStacks: ["React", "Figma", "UI/UX"],
			isActive: true,
			joinedAt: "2026-04-02T14:00:00+09:00",
			hasFilledAvailability: false, // when2meet 아직 미입력
		},
	],
	pendingInvites: [
		{
			id: "inv-1",
			email: "intern@example.com",
			permission: "READ",
			invitedAt: "2026-04-24T10:00:00+09:00",
			expiresAt: "2026-04-25T10:00:00+09:00",
		},
	],
};
