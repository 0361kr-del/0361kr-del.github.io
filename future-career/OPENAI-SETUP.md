# OpenAI 연결 준비 및 남은 단계

## 2026-10-13 교사 시험 화면 추가

- 사용자 제공 CLI 출력으로 `aiPreview` 서울 배포 성공 확인. 사용자가 reCAPTCHA Enterprise App Check 등록 완료를 보고했습니다. 실제 호출은 아직 미검증입니다.
- `/?ai-test`에서 별도 Firebase Google 로그인, UID 확인, 가상 인터뷰 5답변, 3답변 이후 기사 생성 가능. 기존 demo 화면은 유지합니다.
- 공개 사이트키를 `.env.example`에 반영했습니다. Firebase Hosting 배포 전 `.env.example`을 `.env.local`로 복사하고 `npm run build`를 실행합니다.
- 처음 Google 로그인 후 관리자 Cloud Shell에서 `node functions/approve-teacher.mjs`를 실행하면 검증된 Google 계정 `0361kr@gmail.com`만 승인합니다. 존재하지 않는 계정을 생성하거나 임의 이메일을 승인하지 않습니다.
- 프론트엔드 타입 검사 및 Vite 빌드 통과. 승인 스크립트 구문 검사 통과. 브라우저 로그인, App Check 토큰, 실제 AI 호출, Hosting 배포는 사용자 환경에서 확인이 필요합니다.
- 시험 화면의 대화는 브라우저 메모리에만 유지됩니다. 서버는 기존 구현대로 요청·결과와 호출량을 저장합니다. 학생용 실제 AI 기능과 자동 저장 통합은 미완료입니다.

아래는 서버 배포 이전 준비 기록입니다.

2026-10-13 KST. **실제 AI 연결 완료가 아닙니다.** 운영 키, App Check, 승인 교사 UID 및 Firebase 배포가 아직 준비되지 않았습니다. 현재 공개된 소유자 전용 프리뷰는 계속 연습용 질문·기사 틀을 사용합니다.

## 구현

- `functions/src/openai.ts`: OpenAI Responses API, `gpt-4.1-mini-2025-04-14`, strict JSON schema, store:false, 25초 타임아웃. 대화 문맥에 따른 질문 1개 및 인터뷰 기반 기사 출력.
- `functions/src/ai-preview.ts`: 승인된 교사+App Check 전용 callable `aiPreview`. 환경 설정 `OPENAI_TEACHER_PREVIEW_ENABLED` 기본 false. 실제 학생 입장 제한은 유지합니다.
- 서버 Secret Manager의 `OPENAI_API_KEY`만 참조. 프론트엔드·VITE 변수·GitHub·로그에 키를 넣지 않습니다.
- 교사별 하루 30회, 프로젝트 하루 100회 요청을 트랜잭션으로 선예약. 실패도 차감하고 동일 요청 ID를 자동 재호출하지 않습니다. 출력 상한 질문 500 / 기사 2,200 토큰. 이 제한은 OpenAI 시험 호출에만 적용되며 Firebase 전체 요금의 상한이 아닙니다.
- 승인 교사가 가상 정보임을 확인한 요청만 수용. 이름·학급·번호를 API 입력 스키마에 포함하지 않습니다. 대화에 포함된 식별정보가 완전히 제거됨을 보장하지 않습니다. 명백한 이메일·전화번호·주민번호 패턴은 호출 전에 거절합니다.
- 기사 직접 인용은 답변에 실제 포함된 문자열인지 추가 검증합니다. 나머지 사실성·안전성은 실제 모델 품질 검증이 남아 있습니다.

## 사용자 키 등록

1. OpenAI Platform의 API keys에서 프로젝트용 키를 생성합니다. ChatGPT 구독과 별개 API 사용 설정이 필요합니다.
2. 사용자 브라우저에서 Google Cloud Console → 프로젝트 `future-career-interview` → Security → Secret Manager를 엽니다.
3. 비밀 이름 `OPENAI_API_KEY`로 생성하고, 값 입력란에 키를 직접 붙여 넣어 저장합니다. 키를 이 채팅이나 저장소에 붙여 넣지 않습니다.
4. 키 값 대신 등록 완료 여부만 알려 주세요. 이후 서버의 비밀 접근 권한·교사 승인·App Check·배포를 진행합니다.

Firebase CLI를 사용하는 경우 `firebase functions:secrets:set OPENAI_API_KEY --project future-career-interview`의 비공개 입력 프롬프트에서 입력할 수 있습니다. CLI 자체 로그인도 필요합니다. 키를 명령행 인수나 파일에 쓰지 않습니다.

## 미완료

- 서버 비밀 실제 등록, 인증된 배포 경로, App Check 사이트 키, 교사 로그인 UID 검증·승인.
- callable 배포 및 프론트엔드 교사 시험 버튼 연결, 실제 모델 호출 성공/비용 확인.
- 학생 인터뷰 작업 큐·동시성·비용 예약 및 서버 기사 저장과의 통합. 이번 teacher-only 시험 endpoint는 기존 학생 흐름을 활성화하지 않습니다.
- 미성년자 개인정보 처리 및 OpenAI 요구 조건 확인. `store:false`는 Zero Data Retention 승인을 대신하지 않습니다.

## 공식 문서

- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance
