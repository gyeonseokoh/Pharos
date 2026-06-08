import { ItemView, Modal, Notice, WorkspaceLeaf } from "obsidian";
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

		// 현재 로그인 사용자 ID — githubLogin으로 멤버 목록에서 매핑
		const githubLogin = this.plugin.settings.githubLogin;
		const currentUserId =
			members.find((m) => m.name === githubLogin)?.id ?? "";

		// 가용시간 입력 여부 — 멤버별 슬롯 존재 여부 병렬 조회
		const availabilityFlags = await Promise.all(
			members.map(async (m) => {
				const slots = await this.plugin.availabilityService.listByMember(m.id);
				return { id: m.id, filled: slots.length > 0 };
			}),
		);
		const filledSet = new Set(
			availabilityFlags.filter((f) => f.filled).map((f) => f.id),
		);

		this.teamData = {
			currentUserId,
			workspaceId: this.plugin.settings.workspaceId ?? null,
			members: members.map((m) => ({
				id: m.id,
				name: m.name,
				email: m.email,
				role: m.role,
				permission: m.permission,
				techStacks: m.techStacks,
				isActive: m.status === "active",
				joinedAt: m.joinedAt,
				hasFilledAvailability: filledSet.has(m.id),
			})),
			pendingInvites: invites.map((inv) => ({
				token: inv.id,
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
				onRefresh={() => void this.loadAndRender()}
				onChangePermission={(id) => void this.handleChangePermission(id)}
				onDeactivate={(id) => void this.handleDeactivate(id)}
				onRevokeInvite={(token) => void this.handleRevokeInvite(token)}
				onBackToHome={() => void this.openView(VIEW_TYPE_PHAROS_DASHBOARD)}
			/>,
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private async handleChangePermission(memberId: string): Promise<void> {
		if (!this.teamData) return;
		const member = this.teamData.members.find((m) => m.id === memberId);
		if (!member) return;

		const order: Array<"ADMIN" | "WRITE" | "READ"> = ["ADMIN", "WRITE", "READ"];
		const cur = member.permission as "ADMIN" | "WRITE" | "READ";
		const idx = order.indexOf(cur);
		const next = order[(idx === -1 ? 0 : idx + 1) % order.length] as "ADMIN" | "WRITE" | "READ";
		const label = { ADMIN: "관리자", WRITE: "편집", READ: "읽기" }[next];

		try {
			await this.plugin.teamService.updatePermission(memberId, next);
			new Notice(`${member.name}의 권한이 "${label}"으로 변경됐습니다`);
			await this.loadAndRender();
		} catch (err) {
			new Notice(`권한 변경 실패: ${(err as Error).message}`);
		}
	}

	private async handleDeactivate(memberId: string): Promise<void> {
		if (!this.teamData) return;
		const member = this.teamData.members.find((m) => m.id === memberId);
		if (!member) return;

		// Obsidian Modal API로 확인 다이얼로그 표시
		const confirmed = await new Promise<boolean>((resolve) => {
			const modal = new (class extends Modal {
				onOpen() {
					this.contentEl.createEl("h3", { text: "팀원 이탈 처리" });
					this.contentEl.createEl("p", {
						text: `${member.name} 님을 비활성 처리하시겠습니까?`,
					});
					const btnRow = this.contentEl.createDiv({ cls: "modal-button-container" });
					const confirmBtn = btnRow.createEl("button", { text: "확인", cls: "mod-cta" });
					const cancelBtn  = btnRow.createEl("button", { text: "취소" });
					confirmBtn.addEventListener("click", () => { this.close(); resolve(true); });
					cancelBtn.addEventListener("click",  () => { this.close(); resolve(false); });
				}
				onClose() { resolve(false); }
			})(this.app);
			modal.open();
		});

		if (!confirmed) return;

		try {
			await this.plugin.teamService.setStatus(memberId, "left");
			new Notice(`${member.name} 님이 비활성 처리됐습니다`);
			await this.loadAndRender();
		} catch (err) {
			new Notice(`이탈 처리 실패: ${(err as Error).message}`);
		}
	}

	private async handleRevokeInvite(token: string): Promise<void> {
		try {
			await this.plugin.inviteService.revokeToken(token);
			new Notice("초대가 취소됐습니다");
			await this.loadAndRender();
		} catch (err) {
			new Notice(`초대 취소 실패: ${(err as Error).message}`);
		}
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