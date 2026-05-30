import * as Y from 'yjs'
import type { PharosPluginLike } from '../../../app/settings'
import { shouldSync } from './syncFilter'

interface BatchItem {
    documentName: string
    yjsState: string // base64
}

/**
 * BatchSyncService — Vault 전체 일괄 동기화 (Phase B-5)
 *
 * 실행 순서: Upload (Vault → Server) → Download (Server → Vault)
 * initSync() 완료 직후 main.ts에서 호출.
 */
export class BatchSyncService {

    /**
     * 배치 동기화 전체 실행.
     * 오류는 Notice 없이 console.error로만 기록 — 동기화 실패가 플러그인 사용을 막아선 안 됨.
     */
    async run(plugin: PharosPluginLike): Promise<void> {
        const { authToken, workspaceId, hocuspocusServerUrl, syncIgnorePatterns } = plugin.settings

        if (!authToken || !workspaceId || !hocuspocusServerUrl) {
            console.log('[Pharos] BatchSyncService: 인증 정보 부족 — 건너뜀')
            return
        }

        const baseUrl = hocuspocusServerUrl.replace(/\/$/, '')

        try {
            await this.upload(plugin, baseUrl, authToken, workspaceId, syncIgnorePatterns)
            await this.download(plugin, baseUrl, authToken, workspaceId)
        } catch (err) {
            console.error('[Pharos] BatchSyncService 오류:', err)
        }
    }

    // ─── Upload: Vault → Server ─────────────────────────────────────────────

    private async upload(
        plugin: PharosPluginLike,
        baseUrl: string,
        authToken: string,
        workspaceId: number,
        syncIgnorePatterns: string[],
    ): Promise<void> {
        const files = plugin.app.vault.getFiles()
        const items: BatchItem[] = []

        for (const file of files) {
            if (!file.path.endsWith('.md')) continue
            if (!shouldSync(file.path, syncIgnorePatterns)) continue

            const text = await plugin.app.vault.read(file)
            const documentName = `${workspaceId}/${file.path}`

            // 플레인 텍스트 → Yjs Y.Doc으로 감싸 직렬화
            const doc = new Y.Doc()
            doc.getText('content').insert(0, text)
            const encoded = Y.encodeStateAsUpdate(doc)
            doc.destroy()

            items.push({
                documentName,
                yjsState: btoa(String.fromCharCode(...encoded)),
            })
        }

        if (items.length === 0) {
            console.log('[Pharos] BatchSyncService: 업로드할 파일 없음')
            return
        }

        const res = await fetch(`${baseUrl}/sync/batch`, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ workspaceId, items }),
        })

        if (!res.ok) {
            const text = await res.text()
            throw new Error(`POST /sync/batch 실패 (${res.status}): ${text}`)
        }

        const { synced } = await res.json() as { synced: number }
        console.log(`[Pharos] BatchSyncService: ${synced}개 업로드 완료`)
    }

    // ─── Download: Server → Vault ───────────────────────────────────────────

    private async download(
        plugin: PharosPluginLike,
        baseUrl: string,
        authToken: string,
        workspaceId: number,
    ): Promise<void> {
        const res = await fetch(`${baseUrl}/sync/batch?workspaceId=${workspaceId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        })

        if (!res.ok) {
            const text = await res.text()
            throw new Error(`GET /sync/batch 실패 (${res.status}): ${text}`)
        }

        const { items } = await res.json() as { items: BatchItem[] }
        const vault = plugin.app.vault

        // workspaceId prefix 제거용
        const prefix = `${workspaceId}/`
        let created = 0
        let skipped = 0

        for (const item of items) {
            // documentName → 실제 Vault 경로
            if (!item.documentName.startsWith(prefix)) continue
            const filePath = item.documentName.slice(prefix.length)
            if (!filePath.endsWith('.md')) continue

            // 로컬에 이미 있으면 건너뜀 (방금 업로드한 파일 중복 갱신 방지)
            const exists = await vault.adapter.exists(filePath)
            if (exists) {
                skipped++
                continue
            }

            // Yjs decode → 텍스트 추출 → Vault 파일 생성
            const binary = Uint8Array.from(atob(item.yjsState), c => c.charCodeAt(0))
            const doc = new Y.Doc()
            Y.applyUpdate(doc, binary)
            const text = doc.getText('content').toString()
            doc.destroy()

            // 부모 폴더 생성 후 파일 쓰기
            const slash = filePath.lastIndexOf('/')
            if (slash > 0) {
                const dir = filePath.slice(0, slash)
                if (!(await vault.adapter.exists(dir))) {
                    await vault.adapter.mkdir(dir)
                }
            }

            await vault.adapter.write(filePath, text)
            created++
        }

        console.log(`[Pharos] BatchSyncService: 다운로드 완료 — 신규 ${created}개, 건너뜀 ${skipped}개`)
    }
}