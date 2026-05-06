# shared/types/

전역 공유 상수. 의존성 최소 (외부 라이브러리 금지).

## 파일

| 파일 | 역할 |
|---|---|
| `constants.ts` | 공유 상수 — 패턴, UC ID, 스케줄러 이름 |

## 관례

- **Obsidian/React/Zod/외부 SDK 의존성 금지** — 순수 상수만
- 엔티티 타입·Zod 스키마는 각 feature 도메인 폴더에 위치:
  `features/<feature>/domain/<feature>Schema.ts`
- 여러 feature에서 공통으로 참조하는 **상수**만 이 폴더에 둠

## 변경 이력

- v0.1: `entities.ts`, `schemas.ts` 존재 (전역 타입 집중식)
- v0.2: `repository-design.md` 재설계 후 feature별 스키마로 분산.
  `entities.ts`, `schemas.ts` 삭제. `constants.ts`만 유지.
