import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { yCollab } from 'y-codemirror.next'
import { Compartment, StateEffect } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { MarkdownView } from 'obsidian'
import type { ConnectionManager } from './ConnectionManager'


export class DocumentSync {
    private provider: HocuspocusProvider
    readonly doc: Y.Doc
    private yText: Y.Text
    private compartment = new Compartment()
    private cmView: EditorView | null = null
    private isBound = false


    constructor(
        readonly documentName: string,
        private connectionManager: ConnectionManager
    ) {
        this.doc = new Y.Doc()
        this.yText = this.doc.getText('content')
        this.provider = this.connectionManager.acquire({
            documentName,
            doc: this.doc
        })
    }


    bindEditor(markdownView: MarkdownView): void {
        // (비공개 API임) Obsidian 내부 CM6 EditorView에 접근
        const cmView = (markdownView.editor as any).cm as EditorView | undefined
        if (!cmView) {
            console.warn('[Pharos] CM6 EditorView not found:', this.documentName)
            return
        }
        this.cmView = cmView

        const doBind = () => {
            if (this.isBound) return
            this.isBound = true

            // Y.Text가 비어있을 때만 에디터 현재 내용으로 초기화
            // 처음 접속한 클라이언트가 기존 파일 내용을 공유 상태에 알림
            if (this.yText.length === 0) {
                const currentContent = cmView.state.doc.toString()
                if (currentContent.length > 0){
                    this.doc.transact(() => {
                        this.yText.insert(0, currentContent)
                    })
                }
            }

            cmView.dispatch({
                effects: StateEffect.appendConfig.of(
                    this.compartment.of(yCollab(this.yText, null))
                )
            })
            console.log('[Pharos] editor bound:', this.documentName)
        }

        this.provider.on('synced', doBind)
    }


    private unbindEditor(): void {
        if (!this.cmView || !this.isBound) return

        this.cmView.dispatch({
            effects: this.compartment.reconfigure([])
        })

        this.isBound = false
        this.cmView = null
        console.log('[Pharos] editor unbound:', this.documentName)
    }

    destroy(): void {
        this.unbindEditor()
        this.connectionManager.release(this.documentName)
    }
}