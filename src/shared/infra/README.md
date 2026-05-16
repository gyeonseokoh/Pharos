# shared/infra/

외부 시스템 연동 레이어. feature의 `domain/`은 이것들을 통해서만 외부와 통신.

## 파일

| 파일 | 역할 | 사용하는 feature |
|---|---|---|
| `llmClient.ts` | OpenAI(GPT-4o-mini) 호출 래퍼. JSON Schema 강제, 재시도, 비용 로깅 | meeting, roadmap, task |
| `githubClient.ts` | GitHub REST API 폴링 (커밋 조회, 패턴 매칭) | progress |
| `tavilyClient.ts` | Tavily 웹 검색 API | meeting |
| `vaultStore.ts` | Obsidian Vault 파일 I/O 추상화. MVP의 데이터 저장 핵심 | 모든 feature |
| `events.ts` | 앱 내 이벤트 버스. feature 간 직접 import 대신 이벤트로 통신 | (선택) feature 간 통신 |

## `vaultStore` 인터페이스 (v2 전환 대비)

```ts
export interface Store {
  read<T>(path: string): Promise<T | null>;
  write<T>(path: string, data: T): Promise<void>;
  watch<T>(path: string, cb: (data: T) => void): () => void;
  list(pattern: string): Promise<string[]>;
}
```

MVP에서는 `VaultStore`가 이 인터페이스를 구현 (Obsidian Vault 파일로 저장).
v2에서는 `YjsStore`로 교체 (Hocuspocus 서버 동기화). **인터페이스 고정 유지** → 나머지 코드 무변경.

## 환경변수

- `.env` (로컬 보관, git 무시)
  - `OPENAI_API_KEY`
  - `TAVILY_API_KEY`
  - `GITHUB_TOKEN`

## 관례

- 여기 파일은 **feature-agnostic** — 특정 feature 로직 주입 금지
- 모든 외부 호출은 반드시 재시도(최대 3회) + 실패 폴백 제공
- 로깅은 중앙 logger 경유 (추후 추가)
