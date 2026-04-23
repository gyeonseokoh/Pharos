# shared/

**여러 feature가 공유하는 인프라·UI·타입.** feature 내부(`domain/`, `ui/`)에 두면 의존 방향이 꼬이는 것들이 여기로 승격됨.

## 구조

```
shared/
├── infra/        ← 외부 시스템 연동 (LLM, GitHub, Tavily, Vault)
├── ui/           ← 공통 컴포넌트 (Button, BaseModal)
├── scheduler/    ← 공유 스케줄러 (매일 자정, 주간 알림 트리거)
└── types/        ← 전역 공유 타입 (Project, Member, Task 등)
```

## 불변 규칙

- `shared/`는 feature를 **import하지 못함** (단방향 의존)
- `shared/`끼리는 의존 가능 (infra가 types 사용 등)
- feature가 공유 로직이 필요하면 `shared/`로 승격 → 여러 feature가 쓰면 안정화, 한 feature만 쓰면 다시 feature 내로 환원

## 승격 판단 기준

- 2개 이상 feature가 같은 코드를 복사하려 할 때 → `shared/`로
- 외부 시스템 의존성(OpenAI, GitHub API) → 무조건 `shared/infra/`
- UI 기본 컴포넌트(Button, Modal base) → `shared/ui/`
