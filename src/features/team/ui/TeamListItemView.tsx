import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { ProjectRequiredEmpty } from "shared/ui";
import { TeamListView } from "./TeamListView";
import { InviteMemberModal } from "./InviteMemberModal";
import { VIEW_TYPE_PHAROS_DASHBOARD } from "../../progress/ui/DashboardItemView";
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
		if (!this.plugin.settings.projectReport) {
			this.teamData = null;
			this.render();
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
		if (!this.plugin.settings.projectReport) {
			this.root.render(
				<ProjectRequiredEmpty
					viewName="팀원 목록"
					onOpenDashboard={() =>
						void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)
					}
				/>,
			);
			return;
		}
		if (!this.teamData) return;
		this.root.render(
			<TeamListView
				data={this.teamData}
				onInvite={() => new InviteMemberModal(this.app, this.plugin).open()}
				onChangePermission={(id) =>
					new Notice(`[미구현] ${id} 권한 변경 Modal 예정`)
				}
				onDeactivate={(id) =>
					new Notice(`[미구현] ${id} 이탈 처리 확인 Modal 예정 (PO-14, v2)`)
				}
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
