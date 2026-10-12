import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type Transaction } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createHmac, randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { appendAnswer, classInput, DomainError, finishSession, requestIdSchema, startSession, studentInput, type ClassRecord, type Session } from '../../shared/domain.js';

initializeApp();
const db = getFirestore();
const pepper = defineSecret('ACCESS_CODE_PEPPER');
const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const randomToken = () => randomBytes(18).toString('base64url');
const hash = (value: string) => createHmac('sha256', emulator ? 'emulator-only-pepper' : pepper.value()).update(value).digest('hex');
const ref = (path: string) => db.doc(path);
const deny = () => { throw new HttpsError('permission-denied', 'ACCESS_DENIED'); };
const requireFixture = () => { if (!emulator) throw new HttpsError('failed-precondition', 'LIVE_INTERVIEW_NOT_ENABLED'); };
async function teacher(uid: string) { if (!(await ref(`teachers/${uid}`).get()).data()?.active) deny(); }
async function ownedClass(classId: string, uid: string): Promise<ClassRecord> {
  await teacher(uid);
  const c = (await ref(`classes/${id.parse(classId)}`).get()).data() as ClassRecord | undefined;
  if (!c || c.teacherUid !== uid || c.retainUntil <= Date.now() || (c.status as string) === 'DELETING') return deny();
  return c;
}
async function loadSession(sessionId: string, uid: string): Promise<Session> {
  const s = (await ref(`sessions/${id.parse(sessionId)}`).get()).data() as Omit<Session, 'student' | 'messages'> | undefined;
  if (!s || s.retainUntil <= Date.now()) return deny();
  if (s.ownerUid !== uid) { if (s.teacherUid !== uid) return deny(); await teacher(uid); }
  const c = (await ref(`classes/${s.classId}`).get()).data();
  if (!c || c.status === 'DELETING') return deny();
  const [student, messages] = await Promise.all([ref(`sessions/${sessionId}/private/student`).get(), db.collection(`sessions/${sessionId}/messages`).orderBy('seq').get()]);
  return { ...s, student: student.data() as Session['student'], messages: messages.docs.map(d => d.data() as Session['messages'][number]) };
}
function writeSession(tx: Transaction, session: Session, previousMessages = 0) {
  const { student, messages, ...metadata } = session;
  tx.set(ref(`sessions/${session.id}`), metadata);
  if (previousMessages === 0) tx.set(ref(`sessions/${session.id}/private/student`), student);
  for (const m of messages.slice(previousMessages)) tx.create(ref(`sessions/${session.id}/messages/${m.id}`), m);
}

// Per-user server-side admission rate limit. No in-memory counters.
async function limit(uid: string, kind: string, max: number, period = 60000) {
  const bucket = Math.floor(Date.now() / period);
  await db.runTransaction(async tx => {
    const r = ref(`quotaBuckets/${hash(`${uid}:${kind}:${bucket}`)}`);
    const count = (await tx.get(r)).data()?.count ?? 0;
    if (count >= max) throw new HttpsError('resource-exhausted', 'RATE_LIMIT', { retryAfterSeconds: Math.ceil(period / 1000) });
    tx.set(r, { count: count + 1, expiresAt: Date.now() + period * 2 });
  });
}

export const api = onCall({ region: 'asia-northeast3', enforceAppCheck: !emulator, secrets: [pepper], maxInstances: 5, timeoutSeconds: 30 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  const uid = request.auth.uid;
  try {
    const envelope = z.object({ method: z.string(), payload: z.record(z.string(), z.unknown()), requestId: requestIdSchema }).strict().parse(request.data);
    if (Buffer.byteLength(JSON.stringify(request.data)) > 32768) throw new HttpsError('invalid-argument', 'REQUEST_TOO_LARGE');
    const { method, payload: p, requestId } = envelope;
    await limit(uid, 'all', 120);
    if (method === 'teacherStatus') { const t = (await ref(`teachers/${uid}`).get()).data(); return { active: t?.active === true }; }
    if (method === 'listClasses') { await teacher(uid); const q = await db.collection('classes').where('teacherUid', '==', uid).orderBy('createdAt', 'desc').limit(100).get(); return { classes: q.docs.map(d => d.data()).filter(c => c.retainUntil > Date.now() && c.status !== 'DELETING') }; }
    if (method === 'getClassEntry') { const c = await ownedClass(id.parse(p.classId),uid); const entry = (await ref(`classes/${c.id}/private/entry`).get()).data(); if (!entry?.code) throw new HttpsError('failed-precondition','ENTRY_NOT_CONFIGURED'); return { code: entry.code }; }
    if (method === 'resolveClassEntry') {
      await limit(uid,'resolve-entry',10,900000);
      const code = z.string().trim().toUpperCase().regex(/^[A-F0-9]{8}$/).parse(p.code);
      const entry = (await ref(`classCodes/${hash(code)}`).get()).data(); if (!entry || entry.expiresAt <= Date.now()) return deny();
      const c = (await ref(`classes/${entry.classId}`).get()).data() as ClassRecord | undefined;
      if (!c || c.status !== 'OPEN' || c.retainUntil <= Date.now()) throw new HttpsError('failed-precondition','CLASS_UNAVAILABLE');
      return { classInfo: { id:c.id,title:c.title,grade:c.grade,classroom:c.classroom,maxStudents:c.maxStudents } };
    }
    if (method === 'getSession') return { session: await loadSession(id.parse(p.sessionId), uid) };
    if (method === 'resume') { const a = await ref(`studentAccess/${uid}/sessions/${id.parse(p.classId)}`).get(); return a.exists ? { session: await loadSession(a.data()!.sessionId, uid) } : deny(); }
    if (method === 'listSessions') { const c = await ownedClass(id.parse(p.classId), uid); const q = await db.collection('sessions').where('teacherUid', '==', uid).where('classId', '==', c.id).orderBy('updatedAt', 'desc').limit(40).get(); const sessions = await Promise.all(q.docs.filter(d => d.data().retainUntil > Date.now()).map(d => loadSession(d.id, uid))); return { sessions }; }

    // Idempotency records bind to actor, method, payload and ownership epoch.
    const opRef = ref(`privateOperations/${hash(`${uid}:${method}:${requestId}`)}`);
    const requestHash = createHash('sha256').update(JSON.stringify(p)).digest('hex');
    const cached = (await opRef.get()).data();
    if (cached) {
      if (cached.requestHash !== requestHash) throw new HttpsError('aborted', 'IDEMPOTENCY_CONFLICT');
      if (cached.sessionId) await loadSession(cached.sessionId, uid);
      if (['createClass', 'setClassState', 'issueAdmission', 'issueRecovery'].includes(method)) await teacher(uid);
      return cached.result;
    }
    if (method === 'createClass') {
      await teacher(uid); const input = classInput.parse(p); const classId = db.collection('classes').doc().id;
      const code = randomBytes(5).toString('hex').slice(0, 8).toUpperCase();
      const c: ClassRecord = { ...input, id: classId, teacherUid: uid, status: 'OPEN', studentCount: 0, createdAt: Date.now(), retainUntil: Date.now() + 90 * 86400000 };
      const result = { classRecord: c, code };
      return db.runTransaction(async tx => { const old = await tx.get(opRef); if (old.exists) { if (old.data()!.requestHash !== requestHash) throw new HttpsError('aborted', 'IDEMPOTENCY_CONFLICT'); return old.data()!.result; } tx.create(ref(`classes/${classId}`), c); tx.create(ref(`classes/${classId}/private/entry`), { code }); tx.create(ref(`classCodes/${hash(code)}`), { classId, expiresAt: c.retainUntil }); tx.create(opRef, { requestHash, result }); return result; });
    }
    if (method === 'setClassState') {
      const c = await ownedClass(id.parse(p.classId), uid); const status = z.enum(['OPEN', 'CLOSED']).parse(p.status);
      await ref(`classes/${c.id}`).update({ status }); return { status };
    }
    if (method === 'issueAdmission') {
      const c = await ownedClass(id.parse(p.classId), uid);
      const number = z.number().int().min(1).max(c.maxStudents).parse(p.number);
      // Current build accepts fictional participants only, including issuance.
      requireFixture();
      const token = randomToken(); const tokenRef = ref(`admissions/${hash(token)}`); const memberRef = ref(`classes/${c.id}/members/${number}`);
      const result = { token, number };
      return db.runTransaction(async tx => { const [old, member] = await Promise.all([tx.get(opRef), tx.get(memberRef)]); if (old.exists) { if (old.data()!.requestHash !== requestHash) throw new HttpsError('aborted', 'IDEMPOTENCY_CONFLICT'); return old.data()!.result; } if (member.exists) throw new HttpsError('already-exists', 'ADMISSION_ALREADY_ISSUED'); tx.create(memberRef, { number, sessionId: null }); tx.create(tokenRef, { classId: c.id, number, consumedBy: null, expiresAt: c.retainUntil }); tx.create(opRef, { requestHash, result }); return result; });
    }
    // Shared classroom QR grants enrollment only, never access to another student's record.
    if (method === 'joinClassByQr') {
      requireFixture(); await limit(uid,'join',5,900000);
      const input = z.object({ code:z.string().trim().toUpperCase().regex(/^[A-F0-9]{8}$/), student:studentInput.omit({grade:true,classroom:true}) }).strict().parse(p);
      const sessionId = db.collection('sessions').doc().id;
      return db.runTransaction(async tx => {
        const [old,entrySnap] = await Promise.all([tx.get(opRef),tx.get(ref(`classCodes/${hash(input.code)}`))]);
        if(old.exists) { if(old.data()!.requestHash!==requestHash) throw new HttpsError('aborted','IDEMPOTENCY_CONFLICT'); return old.data()!.result; }
        const entry=entrySnap.data(); if(!entry || entry.expiresAt<=Date.now()) return deny();
        const cRef=ref(`classes/${entry.classId}`);const c=(await tx.get(cRef)).data() as ClassRecord | undefined;
        if(!c || c.status!=='OPEN' || c.retainUntil<=Date.now() || c.studentCount>=c.maxStudents) throw new HttpsError('failed-precondition','CLASS_UNAVAILABLE');
        if(input.student.number>c.maxStudents) throw new HttpsError('invalid-argument','STUDENT_CLASS_MISMATCH');
        const pointer=ref(`studentAccess/${uid}/sessions/${c.id}`), member=ref(`classes/${c.id}/members/${input.student.number}`);
        const [prior,membership]=await Promise.all([tx.get(pointer),tx.get(member)]);
        if(prior.exists) throw new HttpsError('already-exists','SESSION_EXISTS');
        if(membership.exists) throw new HttpsError('already-exists','NUMBER_ALREADY_JOINED');
        const student=studentInput.parse({...input.student,grade:c.grade,classroom:c.classroom});
        const session=startSession(sessionId,c,student,uid,Date.now()),result={session};
        writeSession(tx,session);tx.update(cRef,{studentCount:c.studentCount+1});tx.create(member,{number:student.number,sessionId});tx.create(pointer,{sessionId});tx.create(opRef,{requestHash,sessionId,result});return result;
      });
    }
    if (method === 'joinClass') {
      requireFixture(); await limit(uid, 'join', 5, 900000);
      const input = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-F0-9]{8}$/), admissionToken: z.string().min(20).max(128), student: studentInput }).strict().parse(p);
      const sessionId = db.collection('sessions').doc().id;
      return db.runTransaction(async tx => {
        const [old, code, admission] = await Promise.all([tx.get(opRef), tx.get(ref(`classCodes/${hash(input.code)}`)), tx.get(ref(`admissions/${hash(input.admissionToken)}`))]);
        if (old.exists) { if (old.data()!.requestHash !== requestHash) throw new HttpsError('aborted', 'IDEMPOTENCY_CONFLICT'); return old.data()!.result; }
        const a = admission.data(); const codeData = code.data();
        if (!codeData || !a || a.classId !== codeData.classId || a.consumedBy || a.expiresAt <= Date.now() || codeData.expiresAt <= Date.now()) return deny();
        const cRef = ref(`classes/${a.classId}`); const c = (await tx.get(cRef)).data() as ClassRecord;
        const pointer = ref(`studentAccess/${uid}/sessions/${c.id}`); const pointerData = await tx.get(pointer);
        if (pointerData.exists) throw new HttpsError('already-exists', 'SESSION_EXISTS');
        if (c.status !== 'OPEN' || c.retainUntil <= Date.now() || c.studentCount >= c.maxStudents) throw new HttpsError('failed-precondition', 'CLASS_UNAVAILABLE');
        if (input.student.number !== a.number || input.student.classroom !== c.classroom || input.student.grade !== c.grade) throw new HttpsError('invalid-argument', 'STUDENT_CLASS_MISMATCH');
        const session = startSession(sessionId, c, input.student, uid, Date.now());
        const result = { session };
        writeSession(tx, session); tx.update(cRef, { studentCount: c.studentCount + 1 }); tx.update(admission.ref, { consumedBy: uid }); tx.update(ref(`classes/${c.id}/members/${a.number}`), { sessionId }); tx.create(pointer, { sessionId }); tx.create(opRef, { requestHash, sessionId, result }); return result;
      });
    }
    if (method === 'sendAnswer' || method === 'finishInterview') {
      requireFixture(); await limit(uid, 'interview', 6);
      const sessionId = id.parse(p.sessionId);
      // Entire transaction reads the current session and transcript, preventing stale writes.
      return db.runTransaction(async tx => {
        const [old, snap] = await Promise.all([tx.get(opRef), tx.get(ref(`sessions/${sessionId}`))]);
        const metadata = snap.data(); if (!metadata || metadata.ownerUid !== uid || metadata.retainUntil <= Date.now()) return deny();
        const c = (await tx.get(ref(`classes/${metadata.classId}`))).data(); if (!c || c.status === 'DELETING') return deny();
        if (old.exists) { if (old.data()!.requestHash !== requestHash) throw new HttpsError('aborted', 'IDEMPOTENCY_CONFLICT'); return old.data()!.result; }
        const [student, ms] = await Promise.all([tx.get(ref(`sessions/${sessionId}/private/student`)), tx.get(db.collection(`sessions/${sessionId}/messages`).orderBy('seq'))]);
        const session = { ...metadata, student: student.data(), messages: ms.docs.map(d => d.data()) } as Session;
        const { sessionId: ignored, ...answer } = p;
        const next = method === 'sendAnswer' ? appendAnswer(session, answer, uid, Date.now()) : finishSession(session, uid, z.number().int().parse(p.expectedRevision), Date.now());
        const result = { session: next };
        writeSession(tx, next, session.messages.length); tx.create(opRef, { requestHash, sessionId, result }); return result;
      });
    }
    if (method === 'issueRecovery') {
      const session = await loadSession(id.parse(p.sessionId), uid); if (session.teacherUid !== uid) return deny(); await teacher(uid);
      const code = randomToken(); const expiresAt = Date.now() + 600000;
      await ref(`recoveryCodes/${hash(code)}`).create({ sessionId: session.id, expiresAt, consumed: false }); return { code, expiresAt };
    }
    if (method === 'redeemRecovery') {
      requireFixture(); await limit(uid, 'recover', 5, 900000); const code = z.string().min(20).max(128).parse(p.code);
      return db.runTransaction(async tx => {
        const r = ref(`recoveryCodes/${hash(code)}`); const rs = (await tx.get(r)).data(); if (!rs || rs.consumed || rs.expiresAt <= Date.now()) return deny();
        const sr = ref(`sessions/${rs.sessionId}`); const s = (await tx.get(sr)).data(); if (!s || s.retainUntil <= Date.now()) return deny();
        const c = (await tx.get(ref(`classes/${s.classId}`))).data(); if (!c || c.status === 'DELETING') return deny();
        const newPointer = ref(`studentAccess/${uid}/sessions/${s.classId}`); const existing = await tx.get(newPointer); if (existing.exists && existing.data()!.sessionId !== rs.sessionId) throw new HttpsError('already-exists', 'SESSION_EXISTS');
        tx.update(sr, { ownerUid: uid, ownershipEpoch: s.ownershipEpoch + 1, updatedAt: Date.now() }); tx.update(r, { consumed: true }); if (s.ownerUid !== uid) tx.delete(ref(`studentAccess/${s.ownerUid}/sessions/${s.classId}`)); tx.set(newPointer, { sessionId: rs.sessionId }); return { sessionId: rs.sessionId };
      });
    }
    throw new HttpsError('invalid-argument', 'UNKNOWN_METHOD');
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof z.ZodError) throw new HttpsError('invalid-argument', 'INVALID_INPUT');
    if (error instanceof DomainError) throw new HttpsError(error.code === 'ACCESS_DENIED' ? 'permission-denied' : error.code === 'REVISION_CONFLICT' ? 'aborted' : 'failed-precondition', error.code);
    // Deliberately never log request data, tokens, student text or provider bodies.
    throw new HttpsError('internal', 'SAFE_INTERNAL_ERROR');
  }
});
