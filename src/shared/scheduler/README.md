# shared/scheduler/

플러그인 내 주기 작업 스케줄러.

## 파일 (예정)

| 파일 | 역할 |
|---|---|
| `scheduler.ts` | `setInterval` 기반 작업 등록/해제. 한국시간(KST) 기준 발화 |
| `kstTime.ts` | KST 시간 계산 유틸 (`nextKstTime('00:00')` 등) |

## 사용 패턴

```ts
// features/progress/domain/progressService.ts
scheduler.register({
  name: 'daily-progress-digest',
  cron: 'DAILY_KST_00:00',
  handler: () => progressService.refreshAll(),
});

// features/team/domain/weeklyAvailability.ts
scheduler.register({
  name: 'weekly-availability-reminder',
  cron: 'SATURDAY_KST_09:00',
  handler: () => availabilityService.sendReminders(),
});
```

## Obsidian 꺼져있을 때 대응 (MVP)

플러그인 로드 시 `lastRunAt` 확인 → 놓친 실행 보정:
- `localStorage`에 작업별 `lastRunAt` 저장
- 플러그인 시작 시 각 작업의 "다음 실행 시각"보다 `lastRunAt`이 과거면 즉시 1회 실행

v2에서 경석 서버의 `node-cron`으로 이관 → 24/7 발화.
