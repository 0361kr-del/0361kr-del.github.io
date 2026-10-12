# Firebase 연결 진행 상태

## 확인 및 완료
- 프로젝트 ID: `future-career-interview`
- 프로젝트 번호: `16827856751`
- Firebase 콘솔에서 웹 앱 `future-career-web` 등록 완료.
- 앱 ID: `1:16827856751:web:f980d5a8b3946885b01a9a`
- 콘솔에서 확인한 공개 웹 SDK 설정을 `.env.example`과 로컬 `.env.local`에 반영.
- `.firebaserc`의 dev 별칭 지정. 기본 실행은 가상 체험(`demo`) 유지.
- 애널리틱스 SDK는 초기화하지 않음.

Firebase 웹 SDK 설정은 공개 클라이언트 식별 정보이며 OpenAI 서버 비밀 키와 다릅니다. 데이터 접근은 Authentication, Firestore 규칙 및 서버 권한 검증으로 보호합니다. 서비스 계정 JSON·비밀번호·OpenAI 키는 저장소에 넣지 않습니다.

## 남은 구성
Authentication 제공자, Firestore 데이터베이스, App Check, 서버 비밀 키, Functions 및 Hosting 배포는 아직 구성·검증하지 않았습니다. 결제 변경과 배포를 수행하지 않았으며, 앱 등록이 실제 서비스 연결 완료를 의미하지 않습니다. 실제 학생 입장·AI 요청은 준비 완료 전까지 차단합니다.

OpenAI API 키는 서버 Secret Manager에 저장해야 합니다. 실제 학생 사용 전에는 미성년자 데이터 처리 조건과 운영 예산을 확정합니다.

Emulator 사용 시 프로젝트 ID는 반드시 `demo-future-career`로 바꿉니다. 실제 프로젝트 ID로 Emulator 모드를 실행하는 것은 앱에서 거절합니다.
