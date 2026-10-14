import { aiErrors } from './ai-errors.js';
const errors: Record<string, string> = { ...aiErrors, INTERVIEW_TOTAL_LIMIT:'이 활동의 추가 인터뷰 한도에 도달했어요. 기존 기록과 기사는 계속 볼 수 있어요.', AI_REQUEST_PENDING: '다른 요청을 처리 중이에요. 잠시 뒤 저장 기록을 확인하고 다시 시도해 주세요.', AI_RETRY_LIMIT: '이 질문의 재시도 한도에 도달했습니다. 선생님께 알려 주세요.', AI_DAILY_LIMIT: '오늘의 AI 사용 한도에 도달했습니다. 저장된 기록은 유지됩니다.', ENTRY_NOT_CONFIGURED: '이전 방식으로 만든 학급입니다. 새 학급을 만들어 QR을 발급해 주세요.', SESSION_EXISTS: '이미 이 학급에 참여했어요. 처음 화면에서 이어서 하기를 눌러 주세요.', NUMBER_ALREADY_JOINED: '이미 입장한 번호예요. 본인 기록은 이어서 하기로 열고, 다른 학생 번호라면 선생님께 문의하세요.', ACCESS_DENIED: '이 활동에 접근할 권한이 없습니다. 본인 학급 링크인지 확인하거나 선생님께 문의해 주세요.', CLASS_UNAVAILABLE: '입장이 마감되었거나 정원이 찼어요.', STUDENT_CLASS_MISMATCH: '학급 정보와 출석 번호를 확인해 주세요.', REVISION_CONFLICT: '다른 화면에서 내용이 변경되었어요. 기록을 새로 불러와 주세요.', MINIMUM_ANSWERS: '세 번 이상 답한 뒤 마칠 수 있어요.', RATE_LIMIT: '잠시 기다린 뒤 다시 시도해 주세요.', SESSION_NOT_FOUND: '체험 기록이 초기화되었어요. 새로 체험해 주세요.', ADMISSION_ALREADY_ISSUED: '이미 참여권을 발급한 번호예요.', LIVE_INTERVIEW_NOT_ENABLED: '아직 실제 학생용 AI 인터뷰를 열지 않았습니다.', FIREBASE_NOT_CONFIGURED: 'Firebase 프로젝트 연결 설정이 필요합니다.', APPCHECK_NOT_CONFIGURED: 'App Check 설정이 필요합니다.', ARTICLE_SUBMITTED: '이미 제출한 기사는 수정할 수 없어요.', ARTICLE_NOT_FOUND: '먼저 기사 초안을 만들어 주세요.', NOT_AVAILABLE_IN_DEMO: '이번 프리뷰에서는 제공하지 않는 기능입니다.' };
Object.assign(errors,{
 ATTEMPT_LIMIT:'한 학급에서 새 인터뷰는 5회차까지 만들 수 있어요. 기존 활동은 계속 볼 수 있어요.',
 USE_LATEST_ATTEMPT:'기기 변경 링크는 가장 최근 회차에서 발급해 주세요.',
 INVALID_INPUT:'입력값을 확인하지 못했어요. 빈칸·번호 범위·글자 수를 확인해 주세요.',
 SAFE_INTERNAL_ERROR:'서버가 요청을 처리하지 못했어요. 아래 진단 코드를 선생님께 알려 주세요.',
 AUTH_REQUIRED:'로그인이 만료됐어요. 작성 중인 글을 복사한 뒤 다시 접속해 주세요.',
 WRONG_STATE:'현재 진행 단계에서는 이 작업을 할 수 없어요. 저장 기록을 새로 불러와 주세요.',
 IDEMPOTENCY_CONFLICT:'이전 요청과 내용이 달라 처리하지 못했어요. 글을 복사한 뒤 저장 기록을 확인해 주세요.',
 'functions/unknown':'서버나 네트워크에서 예상하지 못한 응답을 받았어요. 아래 진단 코드를 선생님께 알려 주세요.',
 'functions/failed-precondition':'현재 계정 또는 활동 상태에서 요청을 처리할 수 없어요. 선생님께 아래 진단 코드를 알려 주세요.',
 'functions/cancelled':'요청이 취소됐어요. 저장 기록을 먼저 확인해 주세요.',
 TypeError:'브라우저에서 요청을 만들거나 처리하지 못했어요. 브라우저 종류와 아래 진단 코드를 선생님께 알려 주세요.',
 'functions/internal':'서버 응답을 처리하지 못했어요. 아래 진단 코드를 선생님께 알려 주세요.',
 'functions/unauthenticated':'로그인 또는 앱 인증을 확인하지 못했어요. 글을 복사해 두고 선생님께 알려 주세요.',
 'functions/permission-denied':'이 기록에 접근할 권한이 없어요. 본인 학급인지 확인해 주세요.',
 'functions/unavailable':'서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
 'functions/deadline-exceeded':'응답 대기 시간이 길어졌어요. 서버에 저장됐을 수 있으니 저장 기록을 먼저 확인해 주세요.',
 'functions/not-found':'요청한 서버 기능을 찾지 못했어요. 선생님께 알려 주세요.',
 'functions/invalid-argument':'입력값을 확인하지 못했어요. 번호·빈칸·글자 수를 확인해 주세요.',
 'functions/resource-exhausted':'요청 한도에 도달했어요. 잠시 기다린 뒤 선생님께 확인해 주세요.',
 'auth/network-request-failed':'로그인 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
 'auth/web-storage-unsupported':'브라우저 저장 기능을 사용할 수 없어요. 저장 허용 설정을 확인해 주세요.',
 'appCheck/recaptcha-error':'앱 인증을 완료하지 못했어요. 인터넷과 브라우저 차단 설정을 확인해 주세요.',
 QuotaExceededError:'브라우저 저장 공간이 부족해요. 작성 중인 글을 복사해 보관해 주세요.',
 SecurityError:'브라우저가 저장 기능을 차단했어요. 작성 중인 글을 복사해 보관해 주세요.',
});
const stages:Record<string,string>={startNewInterview:'새 인터뷰 시작',listMySessions:'이전 활동 목록',joinClassByQr:'학급 입장',resolveClassEntry:'학급 확인',getSession:'기록 불러오기',continueInterview:'AI 질문 받기',sendAnswer:'답변 저장',finishInterview:'인터뷰 마치기',reopenInterview:'추가 인터뷰',generateArticle:'기사 생성',getArticle:'기사 불러오기',saveArticle:'기사 저장',submitArticle:'최종 제출',resume:'이어하기'};
type Diagnostic={details?:unknown;code?:unknown;message?:unknown;name?:unknown;action?:unknown;requestId?:unknown};
export function withRequestContext(error:unknown,action:string,requestId:string) {
 const source=(error && typeof error==='object'?error:{}) as Diagnostic;
 const wrapped=new Error(typeof source.message==='string'?source.message:'');
 return Object.assign(wrapped,{code:source.code,name:source.name,details:source.details,action,requestId});
}
export function errorText(error:unknown):string {
 const e=(error && typeof error==='object'?error:{}) as Diagnostic;
 const detail=e.details && typeof e.details==='object'?(e.details as {diagnosticCode?:unknown}).diagnosticCode:undefined;
 const code=[detail,e.message,e.code,e.name].find(v=>typeof v==='string' && Object.hasOwn(errors,v)) as string|undefined;
 const sdkCode=typeof e.code==='string' && /^(functions|auth|appCheck)\/[a-z][a-z0-9-]{0,70}$/.test(e.code)?e.code:undefined;
 const shownCode=code||sdkCode||(e.name==='Error'?'CLIENT_ERROR':'UNKNOWN_ERROR');
 const stage=typeof e.action==='string' && Object.hasOwn(stages,e.action)?stages[e.action]:'';
 const request=typeof e.requestId==='string' && /^[a-f0-9-]{36}$/i.test(e.requestId)?' · 요청 '+e.requestId:'';
 return (stage?stage+': ':'')+(code?errors[code]:'요청을 처리하지 못했어요. 작성 중인 글을 보관하고 선생님께 아래 진단 코드를 알려 주세요.')+' (진단: '+shownCode+request+')';
}
