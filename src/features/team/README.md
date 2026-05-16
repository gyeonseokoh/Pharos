# features/team

**담당 UC**: PO-9 팀 동기화/권한, PM-1 초기 가용시간+기술스택, PM-2 주간 가용시간

## 파일

### `domain/`
| 파일 | UC | 역할 |
|---|---|---|
| `Member.ts` | 공통 | Member 엔티티 + role(READ/WRITE/ADMIN) |
| `teamService.ts` | PO-9 | 팀원 CRUD, 활성/비활성 |
| `invitationService.ts` | PO-9 | 프로젝트 코드 생성 + 일회용 토큰(24h) |
| `availabilityService.ts` | PM-1, PM-2 | 가용시간 저장·조회·교집합 계산 |
| `fixedAvailability.ts` | PM-1 | 초기 고정 가용시간 (when2meet 데이터) |
| `weeklyAvailability.ts` | PM-2 | 주간 가용시간 (매주 토 09시 알림) |

### `ui/`
| 파일 | UC |
|---|---|
| `JoinProjectModal.tsx` | PO-9, PM-1 (가입 + when2meet + 기술스택) |
| `TeamMembersView.tsx` | PO-9 (팀원 목록 화면) |
| `WeeklyAvailabilityModal.tsx` | PM-2 |
| `components/When2MeetGrid.tsx` | PM-1, PM-2 공통 (시간 그리드 드래그) |

### `index.ts`
외부 노출:
- `TeamService`, `AvailabilityService` (다른 feature가 참조)
- `JoinProjectModal`, `TeamMembersView`

## 의존성
- `shared/infra/vaultStore`
- MVP에선 서버 없음 — 초대 링크는 "프로젝트 코드" 방식만. 일회용 토큰 링크는 v2
- v2에서 `shared/infra/serverClient` 추가해 Hocuspocus 연결

## 핵심 규칙
- **고정 vs 주간 가용시간 분리**: `fixedAvailability`(1회성, PM-1) vs `weeklyAvailability`(매주, PM-2)
- 주 시작일 = 일요일 (전통 달력)
- MVP에서는 단일 사용자 시뮬레이션 (PO가 여러 팀원 정보 직접 입력 가능)
