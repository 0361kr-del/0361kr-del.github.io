import {nextGuided,explicitlyDeclines} from '../shared/interview-plan';
import { newspaperSchema } from '../shared/newspaper';
import { attachQuestion,saveLiveAnswer,reopenInterview, type LiveSession as Session } from '../shared/live';
import { aiSettingsSchema } from '../shared/ai-settings';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { appendAnswer, fixtureQuestion, classInput, finishSession, startSession, studentInput, type ClassRecord } from '../shared/domain';

export { errorText } from '../shared/client-errors';
import { withRequestContext } from '../shared/client-errors';
import { createPreviewArticle, reviseArticle, submitArticle, type Article } from '../shared/article';

export const demo = import.meta.env.VITE_APP_MODE !== 'firebase';
const emulator = import.meta.env.VITE_USE_EMULATORS === 'true';
let auth: ReturnType<typeof getAuth> | undefined;
let functions: ReturnType<typeof getFunctions> | undefined;
let ready: Promise<void> | undefined;
async function setup() {
  if (demo) return;
  if (!ready) ready = (async () => {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId || !import.meta.env.VITE_FIREBASE_API_KEY || !import.meta.env.VITE_FIREBASE_APP_ID) throw new Error('FIREBASE_NOT_CONFIGURED');
    if (emulator && (!import.meta.env.DEV || !projectId.startsWith('demo-'))) throw new Error('UNSAFE_EMULATOR_CONFIG');
    if (!emulator && !import.meta.env.VITE_APPCHECK_SITE_KEY) throw new Error('APPCHECK_NOT_CONFIGURED');
    const app = initializeApp({ projectId, apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, appId: import.meta.env.VITE_FIREBASE_APP_ID });
    if (!emulator) initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
    auth = getAuth(app); functions = getFunctions(app, import.meta.env.VITE_FIREBASE_REGION || 'asia-northeast3');
    if (emulator) { connectAuthEmulator(auth, 'http://127.0.0.1:9099'); connectFunctionsEmulator(functions, '127.0.0.1', 5001); }
    await auth.authStateReady();
  })();
  return ready;
}
export function watchTeacherLogin(onChange: (signedIn: boolean) => void, onError: (error: unknown) => void) {
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;
  if (demo) { onChange(false); return () => {}; }
  setup().then(() => {
    if (cancelled) return;
    unsubscribe = onAuthStateChanged(auth!, user => onChange(!!user && !user.isAnonymous), onError);
  }).catch(error => { if (!cancelled) onError(error); });
  return () => { cancelled = true; unsubscribe?.(); };
}
export async function login(teacher = false) {
  if (demo) { demoTeacher = teacher; return; }
  await setup();
  if (teacher) { await setPersistence(auth!,browserLocalPersistence);if (!auth!.currentUser || auth!.currentUser.isAnonymous) await signInWithPopup(auth!, new GoogleAuthProvider()); }
  else if (!auth!.currentUser) { await setPersistence(auth!,browserLocalPersistence);await signInAnonymously(auth!); }
  else if(auth!.currentUser.isAnonymous) await setPersistence(auth!,browserLocalPersistence);
}
export async function logout() { if (!demo) { await setup(); await signOut(auth!); } demoTeacher = false; localStorage.removeItem('career-resume-session'); for(const k of Object.keys(sessionStorage)) if(k.startsWith('career-')) sessionStorage.removeItem(k); }
const now = Date.now();
const classes: ClassRecord[] = Array.from({ length: 5 }, (_, i) => ({ id: `demo-class-${i + 1}`, title: `6학년 ${i + 1}반 AI 인터뷰`, classroom: `${i + 1}`, grade: 6, maxStudents: i % 2 ? 22 : 23, questionLimit: 8, objective: '주제를 탐구하고 자신의 생각을 구체적으로 표현해요.', teacherUid: 'demo-teacher', status: 'OPEN', studentCount: 0, createdAt: now + i, retainUntil: now + 90 * 86400000 }));
const sessions = new Map<string, Session>();
const results = new Map<string, { hash: string; value: unknown }>();
const codes = new Map(classes.map((c, i) => [`ABCD600${i + 1}`, c.id]));
const admissions = new Map<string, { classId: string; number: number; used: boolean }>([['SAMPLE-STUDENT-0000000001', { classId: classes[0].id, number: 1, used: false }]]);
const articles = new Map<string, Article>();
const STORAGE_KEY = 'future-career-preview-v2';
export let storageAvailable = true;
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    if (saved.version === 2 && Array.isArray(saved.classes) && Array.isArray(saved.sessions)) {
      classes.splice(0, classes.length, ...saved.classes);
      for (const [k, v] of saved.sessions) sessions.set(k, v);
      for (const [k, v] of saved.articles || []) articles.set(k, v);
      codes.clear(); for (const [k, v] of saved.codes) codes.set(k, v);
      admissions.clear(); for (const [k, v] of saved.admissions) admissions.set(k, v);
    }
  }
} catch { storageAvailable = false; }
// Fictional examples make the teacher preview reviewable immediately.
if (demo && sessions.size === 0) {
  const examples = [
    { idx: 1, name: '가상·하늘', career: '우주 정원사', finished: true, submitted: true, answers: ['우주 정거장에서 채소가 잘 자라도록 빛과 물을 관리합니다.', '식물이 자라는 모습을 기록하고 과학과 생태를 공부했습니다.', '잎이 노랗게 변했을 때 동료와 양분을 점검해 해결했습니다.', '제가 기른 상추를 대원들이 맛있게 먹었을 때 기뻤습니다.', '먼 우주에서도 신선한 음식을 먹을 수 있도록 돕습니다.'] },
    { idx: 2, name: '가상·도윤', career: '해양 생태 연구원', finished: true, submitted: false, answers: ['바닷속 산호와 물고기를 관찰하고 기록합니다.', '수영을 배우고 바다 생물을 꾸준히 공부했습니다.', '흐린 물에서 관찰하기 어려워 다른 시간에 다시 조사했습니다.', '아픈 산호가 건강해지는 모습을 보았을 때 보람을 느꼈습니다.', '바다의 변화를 알려 사람들이 생물을 보호하도록 돕습니다.'] },
    { idx: 3, name: '가상·서연', career: '로봇 디자이너', finished: false, submitted: false, answers: ['사람들이 일상에서 편리하게 사용할 수 있는 로봇을 설계합니다.', '물건을 직접 만들어 보고 코딩과 그림을 배웠습니다.'] }
  ];
  for (const x of examples) {
    const c = classes[x.idx];
    let s = startSession(`sample-${x.idx}`, c, { name: x.name, career: x.career, grade: 6, classroom: c.classroom, number: 1, noticeAccepted: true }, 'demo-student', now);
    for (const text of x.answers) s = appendAnswer(s, { text, questionId: s.currentQuestionId, expectedRevision: s.revision }, 'demo-student', now);
    if (x.finished) s = finishSession(s, 'demo-student', s.revision, now);
    sessions.set(s.id, s); c.studentCount++;
    if (x.finished) {
      let a = createPreviewArticle(s, now);
      if (x.submitted) a = submitArticle(a, { title: '우주에서 키운 상추, 식탁 위에 희망을 심다', subtitle: '우주 정원사 하늘의 가상 인터뷰', body: '미래의 우주 정원사로 일하는 하늘은 우주 정거장에서 채소가 자라도록 빛과 물을 관리한다.\n\n하늘은 식물의 변화를 기록하며 과학과 생태를 공부했다고 이야기했다. 잎이 노랗게 변했을 때는 동료와 함께 양분을 점검해 문제를 해결했다.\n\n“제가 기른 상추를 대원들이 맛있게 먹었을 때 기뻤습니다.” 하늘에게 가장 보람 있는 순간을 묻자 돌아온 답이다.\n\n하늘은 먼 우주에서도 신선한 음식을 먹을 수 있도록 돕고 싶다고 말했다.\n\n※ 이 기사는 미래 직업을 상상한 가상 인터뷰를 바탕으로 썼습니다.' }, a.revision, now);
      articles.set(s.id, a);
    }
  }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, classes, sessions: [...sessions], articles: [...articles], codes: [...codes], admissions: [...admissions] })); storageAvailable = true; }
  catch { storageAvailable = false; }
}
export function resetPreview() {
  localStorage.removeItem(STORAGE_KEY);
  for (const key of Object.keys(localStorage)) if (key.startsWith('career-answer-') || key.startsWith('career-article-')) localStorage.removeItem(key);
  sessionStorage.removeItem('career-session'); location.reload();
}
let demoTeacher = false;
export async function call<T>(method: string, payload: Record<string, unknown> = {}, requestId: string = crypto.randomUUID()): Promise<T> {
  if (!demo) { try { await setup(); return (await httpsCallable(functions!, 'studentApi', {timeout:65000})({ method, payload, requestId })).data as T; } catch(error) { throw withRequestContext(error,method,requestId); } }
  const hash = JSON.stringify({ method, payload }); const cached = results.get(requestId);
  if (cached) { if (cached.hash !== hash) throw new Error('IDEMPOTENCY_CONFLICT'); return cached.value as T; }
  const value = mock(method, payload); results.set(requestId, { hash, value }); persist(); return structuredClone(value) as T;
}
function mock(method: string, p: Record<string, unknown>): unknown {
  if (method === 'getArticle' || method === 'generateArticle' || method === 'saveArticle' || method === 'submitArticle') {
    const session = sessions.get(String(p.sessionId));
    if (!session) throw new Error('SESSION_NOT_FOUND');
    let article = articles.get(session.id);
    if (method === 'getArticle') return { article: article || null };
    if (demoTeacher) throw new Error('ACCESS_DENIED');
    if (method === 'generateArticle') { if (!article) { article = createPreviewArticle(session, Date.now()); articles.set(session.id, article); } return { article }; }
    if (!article) throw new Error('ARTICLE_NOT_FOUND');
    article = method === 'saveArticle' ? reviseArticle(article, p.content, Number(p.expectedRevision), Date.now()) : submitArticle(article, p.content, Number(p.expectedRevision), Date.now());
    articles.set(session.id, article); return { article };
  }
  if (method === 'previewSummary') return { submitted: [...articles.values()].filter(a => a.submitted).map(a => a.sessionId), editing: [...articles.keys()] };
  if (method === 'previewResume') { const session = [...sessions.values()].filter(s => !s.id.startsWith('sample-')).sort((a,b) => b.updatedAt-a.updatedAt)[0]; return { session: session || null }; }

  const teacherOnly = ['updateNewspaper','deleteClass','updateClassAi','createClass', 'listClasses', 'listSessions', 'issueAdmission', 'setClassState', 'issueRecovery', 'getClassEntry'];
  if (teacherOnly.includes(method) && !demoTeacher) throw new Error('ACCESS_DENIED');
  if (method === 'deleteClass') { if(p.confirm!==true)throw new Error('ACCESS_DENIED'); const i=classes.findIndex(c=>c.id===p.classId);if(i>=0)classes.splice(i,1);for(const [sid,s] of sessions)if(s.classId===p.classId){sessions.delete(sid);articles.delete(sid);}for(const [code,cid] of codes)if(cid===p.classId)codes.delete(code);for(const [token,a] of admissions)if(a.classId===p.classId)admissions.delete(token);return {deleted:true}; }
  if (method === 'updateClassAi') { const c=classes.find(c=>c.id===p.classId); if(!c)throw new Error('CLASS_UNAVAILABLE');c.ai=aiSettingsSchema.parse(p.ai);return {classRecord:c}; }
  if (method === 'getClassEntry') { const code = [...codes].find(([,value]) => value === p.classId)?.[0]; if (!code) throw new Error('CLASS_UNAVAILABLE'); return { code }; }
  if (method === 'resolveClassEntry') { const c = classes.find(c => c.id === codes.get(String(p.code).trim().toUpperCase())); if (!c || c.status !== 'OPEN' || c.retainUntil <= Date.now()) throw new Error('CLASS_UNAVAILABLE'); return { classInfo: { id:c.id, title:c.title, grade:c.grade, classroom:c.classroom, maxStudents:c.maxStudents,entryQuestion:c.entryQuestion||'어떤 역할로, 또는 어떤 주제로 이야기하고 싶나요?',description:c.interviewPlan?.topic||c.objective } }; }
  if (method === 'joinClassByQr') {
    const c = classes.find(c => c.id === codes.get(String(p.code).trim().toUpperCase()));
    if (!c || c.status !== 'OPEN' || c.retainUntil <= Date.now()) throw new Error('CLASS_UNAVAILABLE');
    const student = studentInput.parse({ ...(p.student as object), grade:c.grade, classroom:c.classroom });
    const session = startSession(crypto.randomUUID(),c,student,'demo-student',Date.now()); sessions.set(session.id,session); c.studentCount++; return { session };
  }
  if (method === 'getGlobalAi') return {ai:aiSettingsSchema.parse({})};
  if(method==='updateNewspaper'){const c=classes.find(c=>c.id===p.classId);if(!c)throw new Error('CLASS_UNAVAILABLE');c.newspaper=newspaperSchema.parse(p.newspaper);return {classRecord:c};}
  if(method==='getNewspaper'){const s=sessions.get(String(p.sessionId));const c=classes.find(c=>c.id===s?.classId);if(!c)throw new Error('CLASS_UNAVAILABLE');return {newspaper:newspaperSchema.parse(c.newspaper||{})};}
  if (method === 'teacherStatus') return { active: demoTeacher };
  if (method === 'listClasses') return { classes: [...classes] };
  if (method === 'createClass') { const input = classInput.parse(p); const c: ClassRecord = { ...input, id: crypto.randomUUID(), teacherUid: 'demo-teacher', status: 'OPEN', studentCount: 0, createdAt: Date.now(), retainUntil: now + 90 * 86400000 }; const code = crypto.randomUUID().slice(0, 8).toUpperCase(); classes.push(c); codes.set(code, c.id); return { classRecord: c, code }; }
  if (method === 'listSessions') return { sessions: [...sessions.values()].filter(s => s.classId === p.classId) };
  if (method === 'setClassState') { const c = classes.find(c => c.id === p.classId)!; c.status = p.status as ClassRecord['status']; return { status: c.status }; }
  if (method === 'issueAdmission') { if ([...admissions.values()].some(a => a.classId === p.classId && a.number === p.number)) throw new Error('ADMISSION_ALREADY_ISSUED'); const token = crypto.randomUUID(); admissions.set(token, { classId: String(p.classId), number: Number(p.number), used: false }); return { token, number: p.number }; }
  if (method === 'joinClass') { const c = classes.find(c => c.id === codes.get(String(p.code).toUpperCase())); const a = admissions.get(String(p.admissionToken)); const student = studentInput.parse(p.student); if (!c || !a || a.classId !== c.id || a.used || c.status !== 'OPEN') throw new Error('ACCESS_DENIED'); if (student.number !== a.number || student.classroom !== c.classroom || student.grade !== c.grade) throw new Error('STUDENT_CLASS_MISMATCH'); if (c.studentCount >= c.maxStudents) throw new Error('CLASS_UNAVAILABLE'); const session = startSession(crypto.randomUUID(), c, student, 'demo-student', Date.now()); sessions.set(session.id, session); a.used = true; c.studentCount++; return { session }; }
  if(method==='listMySessions'){const current=sessions.get(String(p.sessionId));if(!current)throw new Error('SESSION_NOT_FOUND');return {sessions:[...sessions.values()].filter(s=>s.ownerUid===current.ownerUid&&s.classId===current.classId&&s.student.number===current.student.number).sort((a,b)=>(b.attempt||1)-(a.attempt||1))};}
  if(method==='startNewInterview'){
    const old=sessions.get(String(p.sessionId));if(!old)throw new Error('SESSION_NOT_FOUND');const c=classes.find(c=>c.id===old.classId);if(!c||c.status!=='OPEN')throw new Error('CLASS_UNAVAILABLE');if(old.revision!==p.expectedRevision)throw new Error('REVISION_CONFLICT');
    const count=[...sessions.values()].filter(s=>s.classId===old.classId&&s.student.number===old.student.number).length;
    const student=studentInput.parse({...old.student,career:p.career});const next:Session={...startSession(crypto.randomUUID(),c,student,old.ownerUid,Date.now()),attempt:count+1};sessions.set(old.id,{...old,revision:old.revision+1});sessions.set(next.id,next);c.studentCount++;return {session:next};
  }
  if (method === 'getSession') { const session = sessions.get(String(p.sessionId)); if (!session) throw new Error('SESSION_NOT_FOUND'); return { session }; }
  if(method==='reopenInterview'){const s=sessions.get(String(p.sessionId));if(!s)throw new Error('SESSION_NOT_FOUND');let next=reopenInterview(s,'demo-student',Number(p.expectedRevision),Date.now());if(next.awaitingQuestion){const q={id:`q-${s.answerCount+1}`,seq:s.messages.length+1,role:'reporter' as const,text:fixtureQuestion((s.answerCount%12)+1,s.career),createdAt:Date.now()};next={...next,messages:[...next.messages,q],currentQuestionId:q.id,awaitingQuestion:false};}sessions.set(s.id,next);return {session:next};}
  if(method==='sendAnswer' && sessions.get(String(p.sessionId))?.guided){
   let s=sessions.get(String(p.sessionId))!;const {sessionId:_id,...raw}=p;s=saveLiveAnswer(s,raw,'demo-student',Date.now());
   if(s.awaitingQuestion&&s.guided&&s.settings.interviewPlan){const assessment=explicitlyDeclines(String(p.text))?'skip':String(p.text).length<8?'needs_detail':'sufficient';const next=nextGuided(s.guided,s.settings.interviewPlan,assessment,true);s=attachQuestion(s,'demo-student',s.revision,next.stage==='END'?'이야기를 들려줘서 고맙습니다.':fixtureQuestion(s.answerCount+1,s.career),Date.now(),{assessment,nextStage:next.stage,mainIndex:next.mainIndex});}
   sessions.set(s.id,s);return {session:s};
  }
  if (method === 'sendAnswer' || method === 'finishInterview') { const session = sessions.get(String(p.sessionId)); if (!session) throw new Error('SESSION_NOT_FOUND'); const { sessionId: ignored, ...answer } = p; const next = method === 'sendAnswer' ? {...appendAnswer({...session,settings:{...session.settings,questionLimit:session.answerLimit||session.settings.questionLimit}}, answer, 'demo-student', Date.now()),settings:session.settings} : finishSession(session, 'demo-student', Number(p.expectedRevision), Date.now()); sessions.set(next.id, next); return { session: next }; }
  throw new Error('NOT_AVAILABLE_IN_DEMO');
}
