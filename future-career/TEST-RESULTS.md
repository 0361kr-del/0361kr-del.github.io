# 1단계 기반 구현 검증

검증일: 2026-10-13 KST. 기준 명세 v0.2. 이 문서는 1단계 전체 완료 선언이 아닙니다.

| 항목 | 결과 |
| --- | --- |
| React TypeScript 검사 및 Vite 프로덕션 빌드 | 통과 |
| Cloud Functions TypeScript 빌드 | 통과 |
| 도메인 단위 테스트 | 10개 통과 |
| Firestore 규칙 테스트 | 8개 작성, 실행 환경의 Java libjli.so 오류로 미실행 |
| Functions Emulator 통합·동시성·복구 테스트 | 미실행 |
| 브라우저 E2E·태블릿·115명 부하 테스트 | 미실행 |
| Firebase 콘솔 설정 확인 | 웹 앱·Google 및 익명 제공자·서울 Standard DB·기본 거부 규칙 확인 |
| 실제 로그인 E2E·App Check | 미검증·App Check 미설정 |
| 실제 OpenAI 품질·비용·개인정보 테스트 | 미구현·비활성화 |

실행 명령: `npm run build`, `npm run build:functions`, `npm test`, `npm run test:rules`.

도메인 시험은 학급 정원·질문 기본값, 권한 필드 위조, 공백·길이, 타 학생·만료 세션, 낡은 버전, 정확히 8문항 종료, 최소 3답변 종료, 원문 및 설정 스냅샷 보존, 5개 초과 학급 지원을 확인했습니다.

실행 Node는 24.19.0이며 Firebase 배포 대상은 Node 22입니다. CI는 Node 22와 Java 21에서 같은 빌드·단위·규칙 시험을 수행하도록 구성했습니다. CI 결과는 별도로 확인해야 합니다.

원격 브랜치: `codex/future-career-stage1`. 변경은 `future-career/`와 해당 경로용 CI에만 추가됩니다. 기존 게임 파일 수정·main 병합·운영 배포 없음.

다음 작업: App Check·서버 비밀 및 배포 준비 → 교사 UID 승인 → Emulator 통합시험 → 아동 개인정보 처리 조건 확인 → 비동기 OpenAI 인터뷰와 비용 예약 → 기사 생성·편집·제출.
