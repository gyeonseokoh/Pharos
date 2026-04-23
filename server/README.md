# server/

**경석 담당 서버 코드가 들어올 위치.** 경석 레포지토리에서 받아온 파일들을 여기에 둠.

## 역할 (v2에서 활성화 예정)

| 기능 | 기술 |
|---|---|
| 실시간 문서 동기화 | Hocuspocus (Yjs WebSocket, 포트 1234) |
| 로그인/초대/권한 HTTP API | Express 또는 Fastify (포트 3000) |
| 데이터 영속화 | SQLite (better-sqlite3) |
| 인증 | JWT + bcrypt (+ `lucia-auth` 보일러플레이트 가능) |
| 스케줄러 | node-cron (일일 집계·주간 알림의 서버 버전) |
| GitHub Webhook 수신 | Express 라우트 → Hocuspocus 중계 |
| 인프라 | Oracle Cloud ARM Ubuntu |

## 포트

- `1234`: Hocuspocus WebSocket
- `3000`: HTTP API

## MVP와의 관계

**MVP는 서버 없이 돌아감.** 클라이언트(Pharos 플러그인)가 Obsidian Vault 파일 + 로컬 스케줄러로 전부 처리. 이 폴더는 v2 시점에 경석 코드가 들어올 때 활성화.

## 클라이언트 ↔ 서버 API 계약 (MVP 단계에 미리 합의)

네(프론트) + 경석(서버)이 나중에 붙이기 쉽게 미리 인터페이스만 잡아두는 게 좋음:

- `POST /auth/signup` — `{email, password, name}` → `{token}`
- `POST /auth/login` — `{email, password}` → `{token}`
- `POST /projects/{id}/invite` — `{email?, role}` → `{code, inviteUrl, expiresAt}`
- `POST /projects/{id}/join` — `{code | token, profile}` → `{token, role}`
- Hocuspocus `onAuthenticate`: JWT 검증 → SQLite role 조회 → 문서 접근 허용/거부

## 디렉토리 구조 (경석이 정함, 예시)

```
server/
├── src/
│   ├── hocuspocus.ts      ← Yjs WebSocket 서버
│   ├── http.ts            ← Express 라우트
│   ├── auth.ts            ← JWT + bcrypt
│   ├── db.ts              ← SQLite 래퍼
│   └── cron.ts            ← node-cron 스케줄
├── package.json
└── tsconfig.json
```

## 주의

- 서버 코드는 이 폴더 안에서만 수정
- 클라이언트(`/src`)와 서버(`/server`)는 **별도 package.json**으로 분리
- 공통 타입(예: Member, Task)은 루트 `shared/types.ts`에 둬서 둘 다 import
