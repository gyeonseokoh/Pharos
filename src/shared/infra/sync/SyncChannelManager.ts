import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

/** 서버가 broadcastStateless로 전송하는 트리거 페이로드 */
export interface TriggerPayload {
    type:  'trigger'
    event: 'push' | 'pull_request' | 'issues'
}

export type TriggerCallback = (payload: TriggerPayload) => void

export class SyncChannelManager {
    private provider: HocuspocusProvider | null = null
    private onTrigger: TriggerCallback | null    = null

    /**
     * 트리거 채널에 연결.
     * 이미 연결된 상태에서 재호출하면 기존 연결을 끊고 새로 연결.
     * (token 갱신 시 main.ts에서 재호출)
     *
     * @param serverUrl   - wss://pharos-backend.onrender.com
     * @param workspaceId - settings.workspaceId
     * @param token       - settings.authToken (서버 JWT)
     */
    init(serverUrl: string, workspaceId: number, token: string): void {
        // 기존 연결 정리
        this.destroy()

        const documentName = `${workspaceId}/__trigger__`

        // 트리거 채널은 Yjs 상태를 편집하지 않으므로 빈 Y.Doc 사용
        const doc = new Y.Doc()

        this.provider = new HocuspocusProvider({
            url:      serverUrl,
            name:     documentName,
            document: doc,
            token,
        })

        this.provider.on('stateless', ({ payload }: { payload: string }) => {
            let parsed: unknown
            try {
                parsed = JSON.parse(payload)
            } catch {
                console.warn('[Pharos] SyncChannelManager: invalid stateless payload:', payload)
                return
            }

            if (!isTriggerPayload(parsed)) {
                console.warn('[Pharos] SyncChannelManager: unknown payload type:', parsed)
                return
            }

            console.log(`[Pharos] trigger received: event=${parsed.event}`)
            this.onTrigger?.(parsed)
        })

        this.provider.on('connect', () => {
            console.log(`[Pharos] SyncChannelManager: connected to "${documentName}"`)
        })

        this.provider.on('disconnect', () => {
            console.log(`[Pharos] SyncChannelManager: disconnected from "${documentName}"`)
        })
    }

    /**
     * 트리거 수신 시 호출할 콜백 등록.
     * init() 전에 호출해도 무방 — 콜백은 provider와 독립적으로 저장.
     */
    setOnTrigger(callback: TriggerCallback): void {
        this.onTrigger = callback
    }

    /** 연결 해제 + provider 정리 */
    destroy(): void {
        if (!this.provider) return
        this.provider.destroy()
        this.provider = null
        console.log('[Pharos] SyncChannelManager: destroyed')
    }
}

/** TriggerPayload 타입 가드 */
function isTriggerPayload(value: unknown): value is TriggerPayload {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as any).type === 'trigger' &&
        typeof (value as any).event === 'string'
    )
}