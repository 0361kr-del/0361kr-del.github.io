# Firebase 연결 진행 상태

사용자가 2026-10-13 제공한 프로젝트 ID는 `future-career-interview`, 프로젝트 번호는 `16827856751`입니다. `.firebaserc`에 dev 별칭과 환경 설정 예시에 프로젝트 ID를 반영했습니다. 이는 설정 파일 준비이며 원격 연결·배포 성공을 의미하지 않습니다.

다음으로 이 프로젝트의 웹 앱 등록과 웹 SDK 설정이 필요합니다. `apiKey`, `authDomain`, `appId`는 콘솔의 실제 웹 앱 설정에서 확인하여 `.env.local`에 입력합니다. Firebase 웹 SDK 설정과 OpenAI 서버 비밀 키는 서로 다른 것입니다. 서비스 계정 JSON·비밀번호·OpenAI 키는 저장소에 넣지 않습니다.

원격 관리 기능이 아직 연결되지 않아 웹 앱 등록·Authentication 제공자·Firestore 생성·App Check·결제·Secret Manager·배포를 수행하지 않았습니다. 이 항목들이 준비되기 전까지 기본 가상 체험 모드를 유지합니다.

Emulator 사용 시 환경 변수의 프로젝트 ID는 반드시 `demo-future-career`로 바꿉니다. 실제 프로젝트 ID로 Emulator 모드를 실행하는 것은 앱에서 거절합니다.

README에 있는 '프로젝트 미지정' 상태는 이 파일의 지정 정보로 갱신됩니다. 실제 클라우드 구성 상태는 별도로 검증해야 합니다.
