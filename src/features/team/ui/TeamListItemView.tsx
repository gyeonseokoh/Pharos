import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { TeamListView } from "./TeamListView";
import { InviteMemberModal } from "./InviteMemberModal";
import { PermissionChangeModal } from "./PermissionChangeModal";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────────
// 연동 완료 후 이 import 줄을 삭제하세요.
import { mockTeamListData } from "./teamListMock";
// ──────────────────────────────────────────────────────────────────────────────
import type { PharosPluginLike } from "../../../app/settings";
import type { TeamListData } from "../domain/teamListData";

export const VIEW_TYPE_PHAROS_TEAM_LIST = "pharos-team-list-view";

export class TeamListItemView extends ItemView {
	private root: Root | null = null;
	private teamData: TeamListData | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PharosPluginLike,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PHAROS_TEAM_LIST;
	}

	getDisplayText(): string {
		return "팀원 목록";
	}

	getIcon(): string {
		return "users";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("pharos-root");
		this.root = createRoot(container);
		await this.loadAndRender();

		this.registerEvent(
			this.app.workspace.on("pharos:state-changed" as never, () =>
				void this.loadAndRender(),
			),
		);
	}

	private async loadAndRender(): Promise<void> {
		// ── [DEMO] AI·서버·깃허브 연동 전 임시 데모 시연용 하드코딩 연결 ──────────────
		// 연동 완료 후 이 블록 전체(if 문 포함)를 삭제하세요.
		if (this.plugin.settings.demoMode) {
			this.teamData = mockTeamListData;
			this.render();
			return;
		}
		// ──────────────────────────────────────────────────────────────────────────────

		// ── [연동 후 실행되는 실서비스 흐름] ────────────────────────────────────────────
		// demoMode 블록을 삭제하면 아래 코드가 실행됩니다.
		// settings.projectReport(레거시) 대신 projectService.get()으로 프로젝트를 확인합니다.
		// ────────────────────────────────────────────────────────────────────────────────
		const project = await this.plugin.projectService.get();
		if (!project) {
			this.root?.render(
				<ProjectRequiredEmpty
					viewName="팀원 목록"
					onOpenDashboard={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
				/>,
			);
			return;
		}
		const [members, invites] = await Promise.all([
			this.plugin.teamService.list(),
			this.plugin.teamService.listInvites(),
		]);
		this.teamData = {
			currentUserId: "",
			members: members.map((m) => ({
				id: m.id,
				name: m.name,
				email: m.email,
				role: m.role,
				permission: m.permission,
				techStacks: m.techStacks,
				isActive: m.status === "active",
				joinedAt: m.joinedAt,
				hasFilledAvailability: false,
			})),
			pendingInvites: invites.map((inv) => ({
				id: inv.id,
				email: inv.email,
				permission: inv.permission,
				invitedAt: inv.invitedAt,
				expiresAt: inv.expiresAt,
			})),
		};
		this.render();
	}

	private render(): void {
		if (!this.root) return;
		if (!this.teamData) return;
		this.root.render(
			<TeamListView
				data={this.teamData}
				onInvite={() => new InviteMemberModal(this.app, this.plugin).open()}
				onChangePermission={(id) => {
					// teamData에서 해당 멤버의 이름·현재 권한을 찾아 Modal에 전달
					const member = this.teamData?.members.find((m) => m.id === id);
					if (!member) return;
					new PermissionChangeModal(
						this.app,
						this.plugin,
						member.id,
						member.name,
						member.permission,
					).open();
				}}
				// onDeactivate 콜백 없음 → TeamListView에서 disabled 버튼으로 렌더 (PO-14 v2)
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
			/>,
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private async openView(viewType: string): Promise<void> {
		const { workspace } = this.app;
		const [existing] = workspace.getLeavesOfType(viewType);
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({ type: viewType, active: true });
	}
}
