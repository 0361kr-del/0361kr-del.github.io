import { useRef, useState } from 'react';
import { aiErrors } from '../shared/ai-errors';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, setPersistence, browserSessionPersistence, type User } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getFunctions, httpsCallable } from 'firebase/functions';

type Message = { role: 'reporter' | 'student'; text: string };
type Article = { title: string; subtitle: string; body: string; quotes: string[] };
type Response = { kind: 'question' | 'article'; result: { acknowledgement: string; question: string } | Article; usage: { inputTokens: number; outputTokens: number } | null };
let connection: Promise<ReturnType<typeof getAuth>> | undefined;
function connect() {
  if (!connection) connection = (async () => {
    const app = initializeApp({ apiKey: import.meta.env.VITE_FIREBASE_API_KEY, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, appId: import.meta.env.VITE_FIREBASE_APP_ID }, 'teacher-ai-trial');
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
    const auth = getAuth(app);
    await setPersistence(auth, browserSessionPersistence);
    await auth.authStateReady();
    return auth;
  })();
  return connection;
}
function explain(error: unknown) {
  const e = error as { code?: string; message?: string };
  const text = `${e.code || ''} ${e.message || ''}`;
  if (e.message && Object.hasOwn(aiErrors, e.message)) return `${aiErrors[e.message]} (진단 코드: ${e.message})`;
  if (/ACCESS_DENIED|permission-denied/.test(text)) return '교사 계정 승인이 필요합니다. 아래 로그인 UID를 확인하고 관리자 승인 후 다시 시도하세요.';
  if (/appCheck|app-check|unauthenticated/i.test(text)) return '앱 인증을 확인하지 못했습니다. App Check 등록과 사이트 도메인 설정을 확인하세요.';
  if (/unauthorized-domain/.test(text)) return 'Firebase Authentication의 승인된 도메인에 현재 사이트 주소를 등록해야 합니다.';
  if (/popup-closed|cancelled-popup/.test(text)) return '로그인 창이 닫혔습니다. 다시 로그인할 수 있습니다.';
  if (/popup-blocked/.test(text)) return '브라우저가 로그인 팝업을 차단했습니다. 이 사이트의 팝업을 허용해 주세요.';
  if (/AI_KEY_INVALID/.test(text)) return '서버의 OpenAI 키를 확인해야 합니다.';
  if (/AI_RATE_LIMIT|AI_DAILY_LIMIT|resource-exhausted/.test(text)) return 'API 사용량 또는 시험 호출 한도에 도달했습니다. 잔액과 한도를 확인하세요.';
  if (/PERSONAL_DATA_DETECTED/.test(text)) return '연락처 등 개인정보가 감지되었습니다. 가상 내용만 입력하세요.';
  if (/AI_PREVIEW_NOT_ENABLED/.test(text)) return '서버의 교사 AI 시험 설정이 아직 켜지지 않았습니다.';
  const codes = ['functions/internal','functions/unavailable','functions/deadline-exceeded','functions/not-found','functions/invalid-argument','functions/failed-precondition','auth/network-request-failed'];
  const code = codes.includes(e.code || '') ? e.code : 'UNKNOWN_ERROR';
  return `요청을 완료하지 못했습니다. 입력은 유지됩니다. (진단 코드: ${code})`;
}

export function AiTrial() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const [career, setCareer] = useState('해양 생태 연구원');
  const [confirmed, setConfirmed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState('');
  const [article, setArticle] = useState<Article | null>(null);
  const [usage, setUsage] = useState<Response['usage']>(null);
  const answers = messages.filter(m => m.role === 'student').length;
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(explain(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function request(kind: 'question' | 'article', transcript: Message[]) {
    const auth = await connect();
    if (!auth.currentUser) throw new Error('unauthenticated');
    const result = await httpsCallable<unknown, Response>(getFunctions(auth.app, 'asia-northeast3'), 'aiPreview', { timeout: 65000 })({ requestId: crypto.randomUUID(), input: { kind, career: career.trim(), futureYear: 2040, questionLimit: 5, transcript, fictionalDataConfirmed: true } });
    setUsage(result.data.usage);
    return result.data;
  }
  async function question(transcript: Message[]) {
    const data = await request('question', transcript);
    if (!('question' in data.result)) throw new Error('INVALID_RESPONSE');
    setMessages([...transcript, { role: 'reporter', text: [data.result.acknowledgement, data.result.question].filter(Boolean).join('\n') }]);
    setAnswer('');
  }
  return <><header><a className="brand" href="/">미래의 나, 오늘의 인터뷰</a></header><main>
    <section className="join" style={{ maxWidth: 840, margin: '0 auto' }}>
      <p className="eyebrow">교사 전용 · 실제 AI 연결 시험</p><h1>AI 기자와 대화해 보기</h1>
      <p>성인 교사가 가상 내용으로 시험하는 화면입니다. 실제 학생 정보는 입력하지 마세요. 대화는 새로고침하면 사라지며, 서버에는 시험 요청과 결과가 저장됩니다.</p>
      <p className="muted">교사별 하루 최대 30회 · 프로젝트 전체 하루 최대 100회 · OpenAI 사용료 발생</p>
      {error && <div className="error" role="alert">{error}</div>}
      {!user ? <button disabled={busy} onClick={() => run(async () => { const auth = await connect(); const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }); setUser((await signInWithPopup(auth, provider)).user); })}>Google로 교사 로그인</button> : <div className="credential">
        <p>로그인: {user.email}</p><p style={{ overflowWrap: 'anywhere' }}>교사 승인용 UID: <code>{user.uid}</code></p>
        <button className="quiet" disabled={busy} onClick={() => run(async () => { await signOut(await connect()); setUser(null); setMessages([]); setArticle(null); setAnswer(''); setConfirmed(false); setUsage(null); })}>로그아웃</button>
      </div>}
      {user && <>
        <label>상상할 미래 직업<input value={career} maxLength={80} disabled={busy || messages.length > 0} onChange={e => setCareer(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={confirmed} disabled={busy || messages.length > 0} onChange={e => setConfirmed(e.target.checked)}/>성인 교사이며, 실제 학생 개인정보 없이 가상 내용만 입력합니다.</label>
        {!messages.length && <button disabled={busy || !confirmed || !career.trim()} onClick={() => run(() => question([]))}>AI 첫 질문 받기</button>}
        <div className="messages" aria-live="polite">{messages.map((m, i) => <article className={`bubble ${m.role}`} key={i}><small>{m.role === 'reporter' ? 'AI 기자' : '가상 답변'}</small><p style={{ whiteSpace: 'pre-wrap' }}>{m.text}</p></article>)}</div>
        {!!messages.length && !article && answers < 5 && <form onSubmit={e => { e.preventDefault(); run(async () => { const next: Message[] = [...messages, { role: 'student', text: answer.trim() }]; if (answers + 1 >= 5) { setMessages(next); setAnswer(''); } else await question(next); }); }}>
          <label>가상 답변 ({answers}/5 완료)<textarea value={answer} onChange={e => setAnswer(e.target.value)} maxLength={1000} rows={4} required disabled={busy}/></label>
          <button disabled={busy || !answer.trim()}>{answers === 4 ? '마지막 답변 기록' : '답변 보내고 후속 질문 받기'}</button>
        </form>}
        {answers >= 3 && !article && <button className="secondary" disabled={busy || !!answer.trim()} onClick={() => run(async () => { const data = await request('article', messages); if (!('title' in data.result)) throw new Error('INVALID_RESPONSE'); setArticle(data.result); })}>이 대화로 AI 기사 생성</button>}
        {article && <article className="paper"><p className="eyebrow">미래 직업 가상 인터뷰 · AI 초안</p><h2>{article.title}</h2><h3>{article.subtitle}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{article.body}</p>{article.quotes.map((q, i) => <blockquote key={i}>{q}</blockquote>)}</article>}
        {usage && <p className="muted">직전 AI 요청: 입력 {usage.inputTokens} / 출력 {usage.outputTokens} 토큰</p>}
        <p role="status">{busy ? '처리 중입니다. 잠시 기다려 주세요…' : ''}</p>
        {!!messages.length && <button className="quiet" disabled={busy} onClick={() => { if (confirm('현재 시험 대화와 기사 화면을 비울까요?')) { setMessages([]); setArticle(null); setAnswer(''); setUsage(null); } }}>새 가상 인터뷰</button>}
      </>}
      <p><a href="/">← 기존 체험 화면으로</a></p>
    </section></main></>;
}
