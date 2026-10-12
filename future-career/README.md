# 미래 직업 AI 인터뷰

개발명세 v0.2를 바탕으로 한 **1단계 기반 구현**. 초등학교 6학년, 학급당 22~23명, 5개 이상 학급을 지원하는 구조입니다.

## 현재 상태

- React + TypeScript 반응형 학생 입장·인터뷰·교사 수업 화면.
- Firebase callable API: 교사 승인 확인, 수업 생성·개폐, 개인 참여권, 세션 생성, 인터뷰 답변 저장, 일회용 복구.
- 세션 소유권, 버전 충돌, 최소 답변·질문 수, 서버 요청 제한, Firestore 기본 거절 규칙.
- 기본 실행은 메모리 기반 가상 체험입니다. **실제 AI가 아니며 새로고침하면 체험 기록은 사라집니다.**
- Firebase 모드는 서버 영속 저장을 사용합니다. **실제 학생의 입장·인터뷰·참여권은 서버에서 차단**되어 있으며 Emulator에서만 연습 질문으로 동작합니다.
- OpenAI 연동·비동기 worker·비용 예약·기사 생성/편집/제출·삭제 스케줄은 아직 구현하지 않았습니다. 운영 배포용 완성본이 아닙니다.

## 실행

Node 22 권장. 프로젝트 폴더에서:

```sh
npm ci
npm --prefix functions ci
npm run dev
npm run build
npm test
npm run build:functions
npm run test:rules
```

기본 체험 화면에는 가상 입장 정보가 미리 입력됩니다. 가상 이름·직업만 사용하세요. 교사 화면 체험에서 5개 학급과 신규 수업 추가 기능을 볼 수 있습니다.

## Firebase 연결

1. 전용 프로젝트 `future-career-interview` 및 웹 앱 등록을 완료했습니다. `.firebaserc`에 dev 별칭을 지정했습니다. 구성 확인 기록은 `FIREBASE-SETUP.md`에 있습니다.
2. Google·익명 인증과 서울 리전 Standard Firestore 생성은 완료했습니다. App Check와 실제 로그인 검증은 남아 있습니다. Functions는 Blaze 요금제와 비용 검토가 필요합니다.
3. `.env.example`을 `.env.local`로 복사하고 Firebase 웹 앱의 공개 설정을 입력합니다. OpenAI 키는 VITE 변수에 절대 넣지 않습니다.
4. 교사는 로그인 후 확인한 UID와 검증된 Google 이메일을 운영자가 대조하여 `teachers/{uid}`에 `active:true`를 등록합니다. 사용자 입력 이메일만으로 승인하지 않습니다. 관리자 이메일은 공개 소스에 하드코딩하지 않습니다.
5. `ACCESS_CODE_PEPPER`는 서버 Secret Manager에 등록합니다. 이후 생성되는 수업 코드·참여권의 해시에 사용되므로 임의로 교체하지 않습니다.
6. 대상 연령·기관 개인정보 절차·OpenAI ZDR 적용 여부를 확인한 뒤 별도 변경으로 실제 AI 및 학생 활동을 활성화합니다. 현재 코드의 emulator 보호 조건을 운영 편의상 제거하지 마세요.

Emulator 사용 시 `VITE_APP_MODE=firebase`, `VITE_USE_EMULATORS=true`, `VITE_FIREBASE_PROJECT_ID=demo-future-career`와 테스트용 공개 앱 설정을 지정하고 `npm run build:functions`, `npm run emulators`를 실행합니다. 교사 fixture는 Emulator UI에서만 등록합니다. 기본 체험은 실제 Google 로그인을 흉내내는 테스트 UI입니다.

## 저장소 및 배포

기존 GitHub Pages의 HTML 파일을 수정하지 않고 `future-career/`에 격리했습니다. 배포 대상은 Firebase Hosting입니다. 현재 브랜치를 main에 병합하거나 GitHub Pages에 배포하지 않았습니다. Firebase Hosting 배포는 이 폴더에서 정확한 신규 프로젝트 ID를 명시하여 별도 승인 후 수행합니다.

## 남은 인수 항목

Functions 통합 동시성·중복 요청·복구 검증, 실제 Google 인증/App Check, OpenAI 모델 품질·비용·worker, 115명 동시 접속, 실기기 태블릿, 개인정보 보관·삭제는 후속 검증입니다. 가상 체험과 단위 테스트를 실제 AI/운영 인수 테스트로 간주하지 않습니다.

## 설계 차이 기록

이 첫 증분은 emulator fixture에 한해 입장과 첫 질문을 동시에 저장합니다. 운영 AI 작업 큐는 다음 증분에서 도입합니다. 날짜는 현재 밀리초 숫자로 통일했으며 운영 출시 전 명세의 Firestore Timestamp로 마이그레이션하고 규칙을 함께 갱신해야 합니다. 수업 보관 기간은 현재 생성 후 90일이며 운영에서는 종료 후 90일로 바꾸어야 합니다. 교사 상세 목록은 최대 학급 정원 40명을 반환하며 많은 학급의 페이지네이션은 후속입니다.
