import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

export interface ProviderOptions {
    documentName: string
    doc: Y.Doc
}

export type SyncStatus = 'connecting' | 'synced' | 'disconnected'
type StatusListener = (status: SyncStatus, documentName: string) => void

export class ConnectionManager {
    private _serverUrl = ''
    private _token     = 'anonymous'
    private providers  = new Map<string, HocuspocusProvider>()
    private listeners: StatusListener[] = []

    setServerUrl(url: string): void {
        this._serverUrl = url
    }

    get serverUrl(): string {
        return this._serverUrl
    }

    /**
     * JWT 갱신 시 호출.
     * 활성 provider 전체를 destroy 후 재연결 — token은 연결 수립 시점에만 전송되므로
     * 기존 provider를 유지한 채 token만 교체하는 것은 불가능하다.
     */
    setToken(token: string): void {
        this._token = token

        if (this.providers.size === 0) return

        // 현재 열려있는 documentName 목록 스냅샷 (destroy 중 Map 변경 방지)
        const openDocs = [...this.providers.keys()]

        // 기존 provider 전체 destroy (release 내부 로직과 동일)
        for (const [name, provider] of this.providers) {
            provider.destroy()
            console.log(`[Pharos] token refresh — destroyed provider: ${name}`)
        }
        this.providers.clear()

        // Y.Doc은 DocumentSync가 소유하므로 여기서 재생성 불가.
        // DocumentSync.bindEditor 재호출 책임은 B-Front-4(main.ts)에 있음.
        // 여기서는 로그만 남기고 재연결 신호를 emit.
        for (const name of openDocs) {
            this.emit('disconnected', name)
        }
    }

    onStatusChange(listener: StatusListener): void {
        this.listeners.push(listener)
    }

    private emit(status: SyncStatus, documentName: string): void {
        this.listeners.forEach((l) => l(status, documentName))
    }

    // 문서 열릴 때 호출 — 이미 있으면 재사용
    acquire(options: ProviderOptions): HocuspocusProvider {
        const existing = this.providers.get(options.documentName)
        if (existing) return existing

        const provider = new HocuspocusProvider({
            url:      this._serverUrl,
            name:     options.documentName,
            document: options.doc,
            token:    this._token,          // 항상 최신 token 주입
        })

        provider.on('connect',    () => this.emit('connecting',   options.documentName))
        provider.on('synced',     () => this.emit('synced',       options.documentName))
        provider.on('disconnect', () => this.emit('disconnected', options.documentName))

        this.providers.set(options.documentName, provider)
        console.log(`[Pharos] acquired provider: ${options.documentName} (total: ${this.providers.size})`)
        return provider
    }

    // 문서 닫힐 때 호출
    release(documentName: string): void {
        const provider = this.providers.get(documentName)
        if (!provider) return

        provider.destroy()
        this.providers.delete(documentName)
        console.log(`[Pharos] released provider: ${documentName} (total: ${this.providers.size})`)
    }

    // onunload 시 전체 정리
    destroyAll(): void {
        for (const provider of this.providers.values()) {
            provider.destroy()
        }
        this.providers.clear()
        console.log('[Pharos] ConnectionManager: all providers destroyed')
    }
}