import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

// 문서마다 연결되는 WS의 hocuspocus Provider 생명주기 관리자

export interface ProviderOptions {
    documentName: string
    doc: Y.Doc
    token?: string
}

export class ConnectionManager {
    private _serverUrl = ''
    private providers = new Map<string, HocuspocusProvider>()

    setServerUrl(url: string): void {
        this._serverUrl = url
    }

    get serverUrl(): string {
        return this._serverUrl
    }

    // 문서 열릴 때 호출 — 이미 있으면 재사용
    acquire(options: ProviderOptions): HocuspocusProvider {
        const existing = this.providers.get(options.documentName)
        if (existing) return existing

        const provider = new HocuspocusProvider({
        url: this._serverUrl,
        name: options.documentName,
        document: options.doc,
        token: options.token ?? 'anonymous',
        })

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