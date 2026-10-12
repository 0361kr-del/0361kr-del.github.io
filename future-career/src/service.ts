import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { appendAnswer, classInput, finishSession, startSession, studentInput, type ClassRecord, type Session } from '../shared/domain';

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
    await setPersistence(auth, browserSessionPersistence); await auth.authStateReady();
  })();
  return ready;
}
export async function login(teacher = false) {
  if (demo) { demoTeacher = teacher; return; }
  await setup();
  if (teacher) await signInWithPopup(auth!, new GoogleAuthProvider());
  else if (!auth!.currentUser) await signInAnonymously(auth!);
}
export async function logout() { if (!demo) { await setup(); await signOut(auth!); } demoTeacher = false; sessionStorage.removeItem('career-session'); }
const now = Date.now();
const classes: ClassRecord[] = Array.from({ length: 5 }, (_, i) => ({ id: `demo-class-${i + 1}`, title: `6학년 ${i + 1}반 미래 인터뷰`, classroom: `${i + 1}`, grade: 6, maxStudents: i % 2 ? 22 : 23, questionLimit: 8, futureYear: 2040, objective: '미래 직업의 역할과 사회적 기여를 탐구해요.', teacherUid: 'demo-teacher', status: 'OPEN', studentCount: 0, createdAt: now + i, retainUntil: now + 90 * 86400000 }));
const sessions = new Map<string, Session>();
const results = new Map<string, { hash: string; value: unknown }>();
const codes = new Map(classes.map((c, i) => [`ABCD600${i + 1}`, c.id]));
const admissions = new Map<string, { classId: string; number: number; used: boolean }>([['SAMPLE-STUDENT-0000000001', { classId: classes[0].id, number: 1, used: false }]]);
let demoTeacher = false;
export async function call<T>(method: string, payload: Record<string, unknown> = {}, requestId: string = crypto.randomUUID()): Promise<T> {
  if (!demo) { await setup(); return (await httpsCallable(functions!, 'api')({ method, payload, requestId })).data as T; }
  const hash = JSON.stringify({ method, payload }); const cached = results.get(requestId);
  if (cached) { if (cached.hash !== hash) throw new Error('IDEMPOTENCY_CONFLICT'); return cached.value as T; }
  const value = mock(method, payload); results.set(requestId, { hash, value }); return value as T;
}
function mock(method: string, p: Record<string, unknown>): unknown {
  const teacherOnly = ['createClass', 'listClasses', 'listSessions', 'issueAdmission', 'setClassState', 'issueRecovery'];
  if (teacherOnly.includes(method) && !demoTeacher) throw new Error('ACCESS_DENIED');
  if (method === 'teacherStatus') return { active: demoTeacher };
  if (method === 'listClasses') return { classes: [...classes] };
  if (method === 'createClass') { const input = classInput.parse(p); const c: ClassRecord = { ...input, id: crypto.randomUUID(), teacherUid: 'demo-teacher', status: 'OPEN', studentCount: 0, createdAt: Date.now(), retainUntil: now + 90 * 86400000 }; const code = crypto.randomUUID().slice(0, 8).toUpperCase(); classes.push(c); codes.set(code, c.id); return { classRecord: c, code }; }
  if (method === 'listSessions') return { sessions: [...sessions.values()].filter(s => s.classId === p.classId) };
  if (method === 'setClassState') { const c = classes.find(c => c.id === p.classId)!; c.status = p.status as ClassRecord['status']; return { status: c.status }; }
  if (method === 'issueAdmission') { if ([...admissions.values()].some(a => a.classId === p.classId && a.number === p.number)) throw new Error('ADMISSION_ALREADY_ISSUED'); const token = crypto.randomUUID(); admissions.set(token, { classId: String(p.classId), number: Number(p.number), used: false }); return { token, number: p.number }; }
  if (method === 'joinClass') { const c = classes.find(c => c.id === codes.get(String(p.code).toUpperCase())); const a = admissions.get(String(p.admissionToken)); const student = studentInput.parse(p.student); if (!c || !a || a.classId !== c.id || a.used || c.status !== 'OPEN') throw new Error('ACCESS_DENIED'); if (student.number !== a.number || student.classroom !== c.classroom || student.grade !== c.grade) throw new Error('STUDENT_CLASS_MISMATCH'); if (c.studentCount >= c.maxStudents) throw new Error('CLASS_UNAVAILABLE'); const session = startSession(crypto.randomUUID(), c, student, 'demo-student', Date.now()); sessions.set(session.id, session); a.used = true; c.studentCount++; return { session }; }
  if (method === 'getSession') { const session = sessions.get(String(p.sessionId)); if (!session) throw new Error('SESSION_NOT_FOUND'); return { session }; }
  if (method === 'sendAnswer' || method === 'finishInterview') { const session = sessions.get(String(p.sessionId)); if (!session) throw new Error('SESSION_NOT_FOUND'); const { sessionId: ignored, ...answer } = p; const next = method === 'sendAnswer' ? appendAnswer(session, answer, 'demo-student', Date.now()) : finishSession(session, 'demo-student', Number(p.expectedRevision), Date.now()); sessions.set(next.id, next); return { session: next }; }
  throw new Error('NOT_AVAILABLE_IN_DEMO');
}
const errors: Record<string, string> = { ACCESS_DENIED: '코드와 참여권을 확인하거나 선생님께 문의해 주세요.', CLASS_UNAVAILABLE: '입장이 마감되었거나 정원이 찼어요.', STUDENT_CLASS_MISMATCH: '학년·반·번호가 참여권 정보와 일치하지 않아요.', REVISION_CONFLICT: '다른 화면에서 내용이 변경되었어요. 기록을 새로 불러와 주세요.', MINIMUM_ANSWERS: '세 번 이상 답한 뒤 마칠 수 있어요.', RATE_LIMIT: '잠시 기다린 뒤 다시 시도해 주세요.', SESSION_NOT_FOUND: '체험 기록이 초기화되었어요. 새로 체험해 주세요.', ADMISSION_ALREADY_ISSUED: '이미 참여권을 발급한 번호예요.', LIVE_INTERVIEW_NOT_ENABLED: '아직 실제 학생용 AI 인터뷰를 열지 않았습니다.', FIREBASE_NOT_CONFIGURED: 'Firebase 프로젝트 연결 설정이 필요합니다.', APPCHECK_NOT_CONFIGURED: 'App Check 설정이 필요합니다.', NOT_AVAILABLE_IN_DEMO: '이 기능은 Firebase 연결 후 사용할 수 있습니다.' };
export function errorText(error: unknown) { const message = error instanceof Error ? error.message : ''; return Object.entries(errors).find(([key]) => message.includes(key))?.[1] || '처리하지 못했어요. 연결과 입력을 확인하고 다시 시도해 주세요.'; }
