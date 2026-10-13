import { enrollGoogleTeacher } from './teacher-access.js';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineBoolean } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { safeAiError } from '../../shared/ai-errors.js';
import { aiPreviewInput, generateWithOpenAI } from './openai.js';
const key=defineSecret('OPENAI_API_KEY');
const enabled=defineBoolean('OPENAI_TEACHER_PREVIEW_ENABLED',{default:false});
// A separate teacher-only test endpoint; it cannot enable student AI access.
export const aiPreview=onCall({region:'asia-northeast3',invoker:'public',secrets:[key],enforceAppCheck:true,maxInstances:2,concurrency:10,timeoutSeconds:60,memory:'256MiB'},async request=>{
  if(!request.auth) throw new HttpsError('unauthenticated','AUTH_REQUIRED');
  const uid=request.auth.uid,db=getFirestore();
  if(!await enrollGoogleTeacher(uid,request.auth.token)) throw new HttpsError('permission-denied','ACCESS_DENIED');
  if(!enabled.value()) throw new HttpsError('failed-precondition','AI_PREVIEW_NOT_ENABLED');
  let input: z.infer<typeof aiPreviewInput>,requestId:string;
  try { const data=z.object({requestId:z.uuid(),input:aiPreviewInput}).strict().parse(request.data);input=data.input;requestId=data.requestId; } catch {throw new HttpsError('invalid-argument','INVALID_INPUT');}
  const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const op=db.doc(`aiPreviewOperations/${createHash('sha256').update(uid+':'+requestId).digest('hex')}`);
  const day=new Date().toISOString().slice(0,10),userCounter=db.doc(`aiPreviewQuotas/${day}-${uid}`),globalCounter=db.doc(`aiPreviewQuotas/${day}-project`);
  const cached=await db.runTransaction(async tx=>{
    const [old,u,g]=await Promise.all([tx.get(op),tx.get(userCounter),tx.get(globalCounter)]);
    if(old.exists){const d=old.data()!;if(d.fingerprint!==fingerprint)throw new HttpsError('aborted','IDEMPOTENCY_CONFLICT');if(d.status==='done')return d.result;throw new HttpsError('failed-precondition',d.status==='pending'?'AI_REQUEST_PENDING':'AI_PREVIOUS_REQUEST_FAILED');}
    const uc=u.data()?.count||0,gc=g.data()?.count||0;
    if(uc>=30||gc>=100)throw new HttpsError('resource-exhausted','AI_DAILY_LIMIT');
    // Reserve before contacting OpenAI. Failures stay counted; no automatic paid retries.
    tx.set(userCounter,{count:uc+1});tx.set(globalCounter,{count:gc+1});tx.create(op,{fingerprint,status:'pending',createdAt:Date.now()});return null;
  });
  if(cached)return cached;
  try {const result=await generateWithOpenAI(input,key.value());await op.update({status:'done',result,completedAt:Date.now()});return result;}
  catch(error){await op.update({status:'failed',completedAt:Date.now()});const safe=safeAiError(error);console.warn(JSON.stringify({event:'ai_preview_failed',code:safe}));throw new HttpsError('failed-precondition',safe);}
});
