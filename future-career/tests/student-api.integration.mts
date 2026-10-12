// Firestore emulator only. OpenAI is mocked; no live AI or production data is used.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from '../functions/node_modules/firebase-admin/lib/app/index.js';
import { getFirestore } from '../functions/node_modules/firebase-admin/lib/firestore/index.js';
if(!process.env.FIRESTORE_EMULATOR_HOST || process.env.GCLOUD_PROJECT!=='demo-future-career')throw new Error('Emulator-only test');
process.env.ACCESS_CODE_PEPPER='emulator-test-pepper';process.env.OPENAI_API_KEY='mock-only';process.env.STUDENT_AI_ENABLED='true';
const app=initializeApp({projectId:'demo-future-career'});
const {studentApi}=await import('../functions/src/student-api.ts');
const db=getFirestore();let providerCalls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=(async(url,init)=>{
  if(String(url)!=='https://api.openai.com/v1/responses')throw new Error('Unexpected external request');
  providerCalls++;const body=JSON.parse(String(init?.body));
  const result=body.text.format.name==='interview_question'?{acknowledgement:'알겠습니다.',question:'어떤 경험을 했나요?'}:{title:'미래의 일',subtitle:'가상 인터뷰',body:'[미래 직업 가상 인터뷰] 바다를 관찰했다.',quotes:[]};
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}],usage:{input_tokens:100,output_tokens:50}}));
}) as typeof fetch;
const call=(uid:string,method:string,payload:Record<string,unknown>={},requestId=crypto.randomUUID())=>studentApi.run({auth:{uid,token:{}},data:{method,payload,requestId},rawRequest:{},app:{appId:'test'}} as never) as Promise<any>;
before(async()=>{await db.doc('teachers/teacher').set({active:true});});
after(async()=>{globalThis.fetch=originalFetch;await db.terminate();await deleteApp(app);});
test('class QR, ownership, concurrent generation, immutable original, submission and closed class',async()=>{
 const {classRecord:c,code}=await call('teacher','createClass',{title:'가상 수업',classroom:'1',objective:'진로 탐색',questionLimit:5});
 const student={name:'가상별명',number:1,career:'바다 연구원',noticeAccepted:true};
 let {session:s}=await call('student','joinClassByQr',{code,student});
 await assert.rejects(()=>call('intruder','getSession',{sessionId:s.id}));
 await assert.rejects(()=>call('intruder','joinClassByQr',{code,student}));
 assert.equal((await call('student','joinClassByQr',{code,student})).session.id,s.id);
 const parallel=await Promise.allSettled([call('student','continueInterview',{sessionId:s.id}),call('student','continueInterview',{sessionId:s.id})]);
 assert.ok(parallel.some(x=>x.status==='fulfilled'));assert.equal(providerCalls,1);
 s=(await call('student','getSession',{sessionId:s.id})).session;
 for(let i=0;i<3;i++){
  const requestId=crypto.randomUUID(),payload={sessionId:s.id,text:'바다를 관찰했습니다.',questionId:s.currentQuestionId,expectedRevision:s.revision};
  s=(await call('student','sendAnswer',payload,requestId)).session;
  assert.equal((await call('student','sendAnswer',payload,requestId)).session.answerCount,i+1);
  if(i<2)s=(await call('student','continueInterview',{sessionId:s.id})).session;
 }
 s=(await call('student','finishInterview',{sessionId:s.id,expectedRevision:s.revision})).session;
 let {article:a}=await call('student','generateArticle',{sessionId:s.id});const beforeCalls=providerCalls;
 assert.deepEqual((await call('student','generateArticle',{sessionId:s.id})).article.original,a.original);assert.equal(providerCalls,beforeCalls);
 const original=a.original,content={...a.edited,title:'내가 수정한 제목'};
 a=(await call('student','saveArticle',{sessionId:s.id,content,expectedRevision:a.revision})).article;
 assert.deepEqual(a.original,original);
 await assert.rejects(()=>call('student','saveArticle',{sessionId:s.id,content,expectedRevision:0}));
 a=(await call('student','submitArticle',{sessionId:s.id,content,expectedRevision:a.revision})).article;
 await assert.rejects(()=>call('student','saveArticle',{sessionId:s.id,content,expectedRevision:a.revision}));
 assert.equal((await call('teacher','getArticle',{sessionId:s.id})).article.submitted.title,content.title);
 await assert.rejects(()=>call('intruder','getArticle',{sessionId:s.id}));
 const {code:recovery}=await call('teacher','issueRecovery',{sessionId:s.id});
 assert.equal((await call('replacement','redeemRecovery',{code:recovery})).session.id,s.id);
 await assert.rejects(()=>call('student','getSession',{sessionId:s.id}));
 await assert.rejects(()=>call('intruder','redeemRecovery',{code:recovery}));
 assert.equal((await call('replacement','redeemRecovery',{code:recovery})).session.id,s.id);
 await call('teacher','setClassState',{classId:c.id,status:'CLOSED'});
 await assert.rejects(()=>call('other','joinClassByQr',{code,student:{...student,number:2}}));
});
test('daily budget refuses a provider call before any paid request',async()=>{
 const {code}=await call('teacher','createClass',{title:'예산 시험',classroom:'3',objective:'가상 시험'});
 const {session:s}=await call('teacher','joinClassByQr',{code,student:{name:'가상',number:1,career:'연구원',noticeAccepted:true}});
 await db.doc(`liveBudget/${new Date().toISOString().slice(0,10)}`).set({count:1500,reservedMicros:5000000});
 const previous=providerCalls;
 await assert.rejects(()=>call('teacher','continueInterview',{sessionId:s.id}),/AI_DAILY_LIMIT/);
 assert.equal(providerCalls,previous);
});
test('launch switch prevents anonymous children from joining before review',async()=>{
 process.env.STUDENT_AI_ENABLED='false';
 const {code}=await call('teacher','createClass',{title:'성인 시험',classroom:'2',objective:'가상 시험'});
 const student={name:'가상',number:1,career:'연구원',noticeAccepted:true};
 await assert.rejects(()=>call('anonymous','joinClassByQr',{code,student}),/LIVE_INTERVIEW_NOT_ENABLED/);
 assert.ok((await call('teacher','joinClassByQr',{code,student})).session.id);
});
