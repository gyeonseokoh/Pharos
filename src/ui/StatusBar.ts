// 연결 상태바
import type { SyncStatus } from "core/sync/ConnectionManager"


const STATUS_CONFIG: Record<SyncStatus, { icon: string; label: string; color: string }>
    = {
        connecting:   { icon: '◌', label: '연결 중...',  color: '#e5a50a' },
        synced:       { icon: '●', label: '동기화 중', color: '#4caf50' },
        disconnected: { icon: '○', label: '연결 끊김!', color: '#9e9e9e' }
    }

export class StatusBar {
    private current: SyncStatus = 'disconnected'

    constructor(private readonly el: HTMLElement) {
        this.render()
    }

    setStatus(status: SyncStatus): void {
        if (this.current === status) return
        this.current = status
        this.render()
    }

    private render(): void {
        const { icon, label, color } = STATUS_CONFIG[this.current]
        this.el.style.color = color
        this.el.setText(`${icon} Pharos: ${label}`)
    }
}