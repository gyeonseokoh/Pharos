# shared/ui/

여러 feature에서 쓰는 공통 React 컴포넌트.

## 파일 (예정)

| 파일 | 역할 |
|---|---|
| `Button.tsx` | 기본 버튼 (primary/secondary/danger) |
| `BaseModal.tsx` | Obsidian Modal + React 마운트 래퍼 (각 feature Modal이 상속) |
| `BaseItemView.tsx` | Obsidian ItemView + React 마운트 래퍼 |
| `LoadingSpinner.tsx` | 공통 로딩 표시 |
| `ErrorBoundary.tsx` | React 에러 바운더리 |

## 관례

- **feature 전용 컴포넌트는 여기 두지 않음** — `features/{name}/ui/components/`에 둠
- 스타일은 Obsidian의 CSS 변수 활용 (`--interactive-accent` 등) — 다크/라이트 자동 대응
- 외부 의존성 최소 — `react`만 허용, 나머지는 feature에서 주입
