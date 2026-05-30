# app/

앱 전역 (entry, 설정, DI 컨테이너). Pharos Plugin 클래스와 초기화 로직.

## 담길 파일

| 파일 | 역할 |
|---|---|
| `plugin.ts` | `Plugin`을 상속한 Pharos 메인 클래스. `onload()`/`onunload()`에서 feature 등록 |
| `settings.ts` | `PluginSettingTab` + 설정 스키마 (API 키, 기본값 등) |
| `container.ts` | 의존성 컨테이너 — `llmClient`, `vaultStore` 등 공유 인프라 인스턴스 관리 |
| `commands.ts` | 명령 팔레트 등록 (예: "프로젝트 생성", "회의 주제 생성") |
| `views-registry.ts` | `registerView()` 호출 모음 — feature에서 export한 View 타입을 한 곳에 등록 |

## 관례

- `main.ts`는 최소화: `new PharosPlugin()` 실행만
- 실제 로직은 `plugin.ts`에 — 테스트 편의
- feature 코드는 `container`에서 의존성 주입받음 (Vault, LLM 등을 하드코딩하지 않게)
