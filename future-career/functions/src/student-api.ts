import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineBoolean, defineSecret } from 'firebase-functions/params';
import { getFirestore, type Transaction } from 'firebase-admin/firestore';
import { randomBytes, createHmac, createHash } from 'node:crypto';
import { z } from 'zod';
import { classInput, studentInput, startSession, finishSession, DomainError, type ClassRecord } from '../../shared/domain.js';
import { reviseArticle, submitArticle, type Article } from '../../shared/article.js';
import { saveLiveAnswer, attachQuestion, type LiveSession } from '../../shared/live.js';
import { safeAiError } from '../../shared/ai-errors.js';
import { generateWithOpenAI, buildAiRequest } from './openai.js';

const key = defineSecret('OPENAI_API_KEY'), pepper = defineSecret('ACCESS_CODE_PEPPER');
// Real pupils are enabled only after institutional/privacy review. Approved teachers can test the full flow meanwhile.
const launched = defineBoolean('STUDENT_AI_ENABLED', { default: false });
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const db = () => getFirestore();
const ref = (path: string) => db().doc(path);
const hash = (s: string) => createHmac('sha256', pepper.value()).update(s).digest('hex');
function fail(message: string): never { throw new HttpsError('failed-precondition', message); }
function denied(): never { throw new HttpsError('permission-denied', 'ACCESS_DENIED'); }
async function activeTeacher(uid: string) { return (await ref(`teachers/${uid}`).get()).data()?.active === true; }
async function requireTeacher(uid: string) { if (!await activeTeacher(uid)) denied(); }
async function readClass(classId: string, uid?: string) {
  const c = (await ref(`liveClasses/${id.parse(classId)}`).get()).data() as ClassRecord | undefined;
  if (!c || c.retainUntil <= Date.now()) denied();
  if (uid && c.teacherUid !== uid) denied();
  return c;
}
async function session(sessionId: string, uid: string, owner = false) {
  const s = (await ref(`liveSessions/${id.parse(sessionId)}`).get()).data() as LiveSession | undefined;
  if (!s || s.retainUntil <= Date.now()) denied();
  if (owner ? s.ownerUid !== uid : s.ownerUid !== uid && s.teacherUid !== uid) denied();
  if (s.teacherUid === uid) await requireTeacher(uid);
  await readClass(s.classId);
  await requireTeacher(s.teacherUid);
  return s;
}
async function allowEnrollment(uid: string, teacherUid: string) {
  if (!launched.value() && (uid !== teacherUid || !await activeTeacher(uid))) fail('LIVE_INTERVIEW_NOT_ENABLED');
}
async function rate(uid: string) {
  const r = ref(`liveRate/${hash(uid + ':' + Math.floor(Date.now()/60000))}`);
  await db().runTransaction(async tx => { const n = (await tx.get(r)).data()?.count || 0; if (n >= 120) throw new HttpsError('resource-exhausted','RATE_LIMIT'); tx.set(r,{ count:n+1, expiresAt:Date.now()+120000 }); });
}
async function txOwned(tx: Transaction, sid: string, uid: string) {
  const sr = ref(`liveSessions/${sid}`), s = (await tx.get(sr)).data() as LiveSession | undefined;
  if (!s || s.ownerUid !== uid || s.retainUntil <= Date.now()) denied();
  const c = (await tx.get(ref(`liveClasses/${s.classId}`))).data() as ClassRecord | undefined;
  if (!c || c.retainUntil <= Date.now()) denied();
  if (c.status !== 'OPEN') fail('CLASS_UNAVAILABLE');
  return { sr, s, c };
}
function publicSession(s: LiveSession) { const { aiLease: _lease, ...safe } = s; return safe; }

async function generate(sid: string, uid: string, kind: 'question' | 'article') {
  const initial = await session(sid, uid, true);
  await allowEnrollment(uid, initial.teacherUid);
  const job = ref(`liveAiJobs/${sid}-${kind}-${kind==='question'?initial.answerCount:0}`);
  const ar = ref(`liveArticles/${sid}`), token = randomBytes(16).toString('hex');
  const started = Date.now();
  const reservation = await db().runTransaction(async tx => {
    const {sr,s} = await txOwned(tx,sid,uid);
    const [old, article] = await Promise.all([tx.get(job), tx.get(ar)]);
    if (kind==='article' && article.exists) return { cached:true, s };
    if (kind==='question' && !s.awaitingQuestion) return { cached:true, s };
    if (s.revision!==initial.revision) fail('REVISION_CONFLICT');
    if (kind==='article' && s.status!=='INTERVIEW_COMPLETED') fail('WRONG_STATE');
    if (s.aiLease && s.aiLease.expiresAt>Date.now()) fail('AI_REQUEST_PENDING');
    if ((old.data()?.attempts || 0)>=3) fail('AI_RETRY_LIMIT');
    const input = { kind, career:s.career, futureYear:s.settings.futureYear, questionLimit:s.settings.questionLimit, transcript:s.messages.map(m=>({role:m.role,text:m.text})), fictionalDataConfirmed:true as const };
    const request = buildAiRequest(input);
    // UTF-8 byte count is a conservative input-token reservation for this fixed text model.
    const inputBound = Buffer.byteLength(JSON.stringify(request),'utf8') + 1024;
    const reserveMicros = Math.ceil(inputBound*0.4 + request.max_output_tokens*1.6);
    const day = new Date().toISOString().slice(0,10);
    const qr = ref(`liveBudget/${day}`), sq = ref(`liveSessionBudget/${sid}`);
    const [q,t] = await Promise.all([tx.get(qr),tx.get(sq)]);
    const count = q.data()?.count || 0, reserved = q.data()?.reservedMicros || 0, calls = t.data()?.count || 0;
    if (count>=1500 || reserved+reserveMicros>5000000 || calls>=s.settings.questionLimit*3+3) throw new HttpsError('resource-exhausted','AI_DAILY_LIMIT');
    tx.set(qr,{count:count+1,reservedMicros:reserved+reserveMicros});
    tx.set(sq,{count:calls+1});
    tx.set(job,{token,status:'pending',attempts:(old.data()?.attempts||0)+1,createdAt:started,reserveMicros});
    tx.update(sr,{aiLease:{token,expiresAt:started+90000}});
    return {cached:false,s,input};
  });
  if (reservation.cached) return;
  try {
    const result = await generateWithOpenAI(reservation.input!,key.value());
    await db().runTransaction(async tx => {
      const {sr,s} = await txOwned(tx,sid,uid);
      if (s.aiLease?.token!==token || s.revision!==reservation.s.revision) fail('REVISION_CONFLICT');
      if (kind==='question') {
        if (!('question' in result.result)) fail('AI_INVALID_OUTPUT');
        const question = [result.result.acknowledgement,result.result.question].filter(Boolean).join('\n');
        tx.set(sr,attachQuestion(s,uid,s.revision,question,Date.now()));
      } else {
        if (!('title' in result.result)) fail('AI_INVALID_OUTPUT');
        const r=result.result;
        const original={title:r.title,subtitle:r.subtitle,body:[r.body,...r.quotes.map(q=>`“${q}”`)].join('\n\n')};
        const article: Article={sessionId:sid,original,edited:{...original},submitted:null,revision:0,updatedAt:Date.now(),submittedAt:null,generator:'openai'};
        tx.create(ar,article);tx.update(sr,{aiLease:null,articleState:'editing'});
      }
      tx.update(job,{status:'done',usage:result.usage,durationMs:Date.now()-started});
    });
  } catch(error) {
    const code = safeAiError(error);
    await db().runTransaction(async tx => { const sr=ref(`liveSessions/${sid}`); const s=(await tx.get(sr)).data(); if(s?.aiLease?.token===token){ tx.update(sr,{aiLease:null});tx.update(job,{status:'failed',code,durationMs:Date.now()-started}); } });
    console.warn(JSON.stringify({event:'student_ai_failed',code}));
    throw new HttpsError('failed-precondition',code);
  }
}

export const studentApi = onCall({region:'asia-northeast3',invoker:'public',enforceAppCheck:true,secrets:[key,pepper],timeoutSeconds:60,maxInstances:5,concurrency:20,memory:'256MiB'},async request => {
  if(!request.auth) throw new HttpsError('unauthenticated','AUTH_REQUIRED');
  const uid=request.auth.uid;
  try {
    if(Buffer.byteLength(JSON.stringify(request.data))>32768) fail('INVALID_INPUT');
    const {method,payload:p,requestId}=z.object({method:z.string(),payload:z.record(z.string(),z.unknown()),requestId:z.uuid()}).strict().parse(request.data);
    await rate(uid);
    if(method==='teacherStatus') return {active:await activeTeacher(uid)};
    if(method==='createClass') {
      await requireTeacher(uid);const input=classInput.parse(p);
      const cRef=db().collection('liveClasses').doc(), code=randomBytes(5).toString('hex').toUpperCase();
      const c:ClassRecord={...input,id:cRef.id,teacherUid:uid,status:'OPEN',studentCount:0,createdAt:Date.now(),retainUntil:Date.now()+90*86400000};
      const op=ref(`liveOps/${hash(uid+':'+requestId)}`),fingerprint=createHash('sha256').update(JSON.stringify(p)).digest('hex');
      return db().runTransaction(async tx=>{const prior=(await tx.get(op)).data();if(prior){if(prior.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return prior.result;}const result={classRecord:c,code};tx.create(cRef,c);tx.create(ref(`liveCodes/${hash(code)}`),{classId:c.id});tx.create(ref(`liveClasses/${c.id}/private/entry`),{code});tx.create(op,{fingerprint,result});return result;});
    }
    if(method==='listClasses') {await requireTeacher(uid);const q=await db().collection('liveClasses').where('teacherUid','==',uid).limit(100).get();return {classes:q.docs.map(d=>d.data()).filter(c=>c.retainUntil>Date.now()).sort((a,b)=>b.createdAt-a.createdAt)};}
    if(method==='getClassEntry'||method==='setClassState'||method==='listSessions') {
      await requireTeacher(uid);const c=await readClass(id.parse(p.classId),uid);
      if(method==='getClassEntry') return {code:(await ref(`liveClasses/${c.id}/private/entry`).get()).data()?.code};
      if(method==='setClassState'){const status=z.enum(['OPEN','CLOSED']).parse(p.status);await ref(`liveClasses/${c.id}`).update({status});return {status};}
      const q=await db().collection('liveSessions').where('classId','==',c.id).limit(40).get();return {sessions:q.docs.map(d=>publicSession(d.data() as LiveSession))};
    }
    if(method==='resolveClassEntry'||method==='joinClassByQr') {
      const code=z.string().trim().toUpperCase().regex(/^[A-F0-9]{10}$/).parse(p.code);
      const entry=(await ref(`liveCodes/${hash(code)}`).get()).data();if(!entry)denied();
      const c=await readClass(entry.classId);await requireTeacher(c.teacherUid);if(c.status!=='OPEN')fail('CLASS_UNAVAILABLE');
      if(method==='resolveClassEntry')return {classInfo:{id:c.id,title:c.title,grade:c.grade,classroom:c.classroom,maxStudents:c.maxStudents,teacherOnly:!launched.value()}};
      await allowEnrollment(uid,c.teacherUid);
      const student=studentInput.parse({...studentInput.omit({grade:true,classroom:true}).parse(p.student),grade:c.grade,classroom:c.classroom});
      if(student.number>c.maxStudents)fail('STUDENT_CLASS_MISMATCH');
      const sid=db().collection('liveSessions').doc().id;
      const result=await db().runTransaction(async tx=>{
        const cr=ref(`liveClasses/${c.id}`),ptr=ref(`liveAccess/${uid}/classes/${c.id}`),member=ref(`liveClasses/${c.id}/members/${student.number}`);
        const [fresh,prior,occupied]=await Promise.all([tx.get(cr),tx.get(ptr),tx.get(member)]);
        if(prior.exists)return {sid:prior.data()!.sessionId};
        const current=fresh.data() as ClassRecord;if(!current||current.status!=='OPEN'||current.retainUntil<=Date.now()||current.studentCount>=current.maxStudents)fail('CLASS_UNAVAILABLE');
        if(occupied.exists)fail('NUMBER_ALREADY_JOINED');
        const s:LiveSession={...startSession(sid,current,student,uid,Date.now()),messages:[],currentQuestionId:'',awaitingQuestion:true};
        tx.create(ref(`liveSessions/${sid}`),s);tx.create(ptr,{sessionId:sid});tx.create(member,{sessionId:sid});tx.update(cr,{studentCount:current.studentCount+1});return {sid};
      });return {session:publicSession(await session(result.sid,uid,true))};
    }
    if(method==='redeemRecovery') {
      const token=z.string().regex(/^[A-Za-z0-9_-]{32}$/).parse(p.code),rr=ref(`liveRecovery/${hash(token)}`);
      const info=(await rr.get()).data();if(!info)denied();
      const existing=(await ref(`liveSessions/${info.sessionId}`).get()).data() as LiveSession|undefined;if(!existing)denied();await allowEnrollment(uid,existing.teacherUid);
      const sid=await db().runTransaction(async tx=>{
        const r=(await tx.get(rr)).data();if(!r||r.expiresAt<=Date.now())denied();
        const sr=ref(`liveSessions/${r.sessionId}`),s=(await tx.get(sr)).data() as LiveSession|undefined;
        if(!s||s.retainUntil<=Date.now())denied();
        if(r.consumedBy){if(r.consumedBy===uid&&s.ownerUid===uid)return s.id;denied();}
        if(s.ownershipEpoch!==r.epoch)denied();if(s.aiLease&&s.aiLease.expiresAt>Date.now())fail('AI_REQUEST_PENDING');
        const c=(await tx.get(ref(`liveClasses/${s.classId}`))).data();if(!c||c.retainUntil<=Date.now())denied();
        const ptr=ref(`liveAccess/${uid}/classes/${s.classId}`),prior=(await tx.get(ptr)).data();if(prior&&prior.sessionId!==s.id)fail('SESSION_EXISTS');
        tx.update(sr,{ownerUid:uid,ownershipEpoch:s.ownershipEpoch+1,updatedAt:Date.now()});
        tx.update(rr,{consumedBy:uid});tx.set(ptr,{sessionId:s.id});
        if(s.ownerUid!==uid)tx.delete(ref(`liveAccess/${s.ownerUid}/classes/${s.classId}`));return s.id;
      });return {session:publicSession(await session(sid,uid,true))};
    }
    if(method==='resume'){const ptr=(await ref(`liveAccess/${uid}/classes/${id.parse(p.classId)}`).get()).data();if(!ptr)denied();return {session:publicSession(await session(ptr.sessionId,uid,true))};}
    const sid=id.parse(p.sessionId);const s=await session(sid,uid);
    if(method==='issueRecovery') {
      if(s.teacherUid!==uid)denied();await requireTeacher(uid);
      const code=randomBytes(24).toString('base64url');await ref(`liveRecovery/${hash(code)}`).create({sessionId:s.id,epoch:s.ownershipEpoch,expiresAt:Date.now()+600000,consumedBy:null});return {code};
    }
    if(method==='getSession')return {session:publicSession(s)};
    if(method==='getArticle')return {article:(await ref(`liveArticles/${sid}`).get()).data()||null};
    if(method==='continueInterview'||method==='generateArticle') {
      if(s.ownerUid!==uid)denied();
      await generate(sid,uid,method==='continueInterview'?'question':'article');
      return method==='continueInterview'?{session:publicSession(await session(sid,uid,true))}:{article:(await ref(`liveArticles/${sid}`).get()).data()||null};
    }
    if(['sendAnswer','finishInterview','saveArticle','submitArticle'].includes(method)) {
      const op=ref(`liveOps/${hash(uid+':'+requestId)}`),fingerprint=createHash('sha256').update(JSON.stringify({method,p})).digest('hex');
      return db().runTransaction(async tx=>{
        const {sr,s}=await txOwned(tx,sid,uid);const prior=(await tx.get(op)).data();
        if(prior){if(prior.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return prior.result;}
        if(s.aiLease && s.aiLease.expiresAt>Date.now())fail('AI_REQUEST_PENDING');
        let result;
        if(method==='sendAnswer'||method==='finishInterview') {
          const {sessionId:_sid,...raw}=p;
          const next=method==='sendAnswer'?saveLiveAnswer(s,raw,uid,Date.now()):{...finishSession(s,uid,z.number().int().parse(p.expectedRevision),Date.now()),awaitingQuestion:false};
          tx.set(sr,next);result={session:publicSession(next)};
        } else {
          const ar=ref(`liveArticles/${sid}`),a=(await tx.get(ar)).data() as Article|undefined;if(!a)fail('ARTICLE_NOT_FOUND');
          const revision=z.number().int().nonnegative().parse(p.expectedRevision);
          const next=method==='saveArticle'?reviseArticle(a,p.content,revision,Date.now()):submitArticle(a,p.content,revision,Date.now());
          tx.set(ar,next);tx.update(sr,{articleState:next.submitted?'submitted':'editing',updatedAt:Date.now()});result={article:next};
        }
        tx.create(op,{fingerprint,result});return result;
      });
    }
    fail('UNKNOWN_METHOD');
  } catch(error) {
    if(error instanceof HttpsError)throw error;
    if(error instanceof DomainError)throw new HttpsError('failed-precondition',error.code);
    if(error instanceof z.ZodError)throw new HttpsError('invalid-argument','INVALID_INPUT');
    console.error(JSON.stringify({event:'student_api_internal',code:'SAFE_INTERNAL_ERROR'}));
    throw new HttpsError('internal','SAFE_INTERNAL_ERROR');
  }
});
