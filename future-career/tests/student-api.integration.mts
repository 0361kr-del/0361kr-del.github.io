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
  assert.equal(body.model,'gpt-5.4-mini-2026-03-17');assert.deepEqual(body.reasoning,{effort:'none'});assert.ok(body.instructions.startsWith(body.text.format.name==='interview_question'?'저장된 인터뷰 본문':'저장된 기사 본문'));
  const result=body.text.format.name==='interview_question'?{acknowledgement:'알겠습니다.',question:'어떤 경험을 했나요?'}:{title:'미래의 일',subtitle:'가상 인터뷰',body:'[미래 직업 가상 인터뷰] 바다를 관찰했다.',quotes:[]};
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}],usage:{input_tokens:100,output_tokens:50}}));
}) as typeof fetch;
const call=(uid:string,method:string,payload:Record<string,unknown>={},requestId=crypto.randomUUID())=>studentApi.run({auth:{uid,token:{}},data:{method,payload,requestId},rawRequest:{},app:{appId:'test'}} as never) as Promise<any>;
before(async()=>{await db.doc('teachers/teacher').set({active:true});});
after(async()=>{globalThis.fetch=originalFetch;await db.terminate();await deleteApp(app);});
test('class QR, ownership, concurrent generation, immutable original, submission and closed class',async()=>{
 const {classRecord:c,code}=await call('teacher','createClass',{title:'가상 수업',classroom:'1',objective:'진로 탐색',questionLimit:5});
 const student={name:'가상별명',number:1,career:'바다 연구원',noticeAccepted:true};
 const ai={model:'gpt-5.4-mini-2026-03-17',tone:'차분한 기자',interviewInstructions:'환경 보호 경험',articleInstructions:'사회 기여',interviewSystemPrompt:'저장된 인터뷰 본문',articleSystemPrompt:'저장된 기사 본문'};
 await assert.rejects(()=>call('intruder','updateClassAi',{classId:c.id,ai}));
 await call('teacher','updateClassAi',{classId:c.id,ai});
 let {session:s}=await call('student','joinClassByQr',{code,student});
 assert.equal(s.settings.ai.model,ai.model);
 await call('teacher','updateClassAi',{classId:c.id,ai:{...ai,model:'gpt-4.1-mini-2025-04-14',interviewSystemPrompt:'새 학생용 본문'}});
 assert.equal((await call('student','getSession',{sessionId:s.id})).session.settings.ai.model,ai.model);
 const second=(await call('student-two','joinClassByQr',{code,student:{...student,number:2}})).session;
 assert.equal(second.settings.ai.model,'gpt-4.1-mini-2025-04-14');assert.equal(second.settings.ai.interviewSystemPrompt,'새 학생용 본문');
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
 const unrelated=(await call('teacher','createClass',{title:'유지할 수업',classroom:'4',objective:'진로'})).classRecord;
 await assert.rejects(()=>call('intruder','deleteClass',{classId:c.id,confirm:true}));
 await assert.rejects(()=>call('teacher','deleteClass',{classId:c.id,confirm:false}));
 // Simulate an interrupted delete after the access gate has closed, then resume.
 await db.doc(`liveClasses/${c.id}`).update({deleting:true});
 await assert.rejects(()=>call('replacement','getSession',{sessionId:s.id}));
 await call('teacher','deleteClass',{classId:c.id,confirm:true});
 assert.equal((await db.doc(`liveClasses/${c.id}`).get()).exists,false);
 assert.equal((await db.doc(`liveClasses/${unrelated.id}`).get()).exists,true);
 for(const collection of ['liveSessions','liveCodes'])assert.equal((await db.collection(collection).where('classId','==',c.id).get()).size,0);
 for(const path of [`liveArticles/${s.id}`,`liveSessionBudget/${s.id}`,`liveAccess/replacement/classes/${c.id}`,`liveAccess/student-two/classes/${c.id}`])assert.equal((await db.doc(path).get()).exists,false);
 assert.equal((await db.collection('liveRecovery').where('sessionId','==',s.id).get()).size,0);
 assert.equal((await db.collection('liveAiJobs').orderBy('__name__').startAt(s.id+'-').endAt(s.id+'-\uf8ff').get()).size,0);
 for(const [field,value] of [['result.session.id',s.id],['result.article.sessionId',s.id],['result.classRecord.id',c.id]])assert.equal((await db.collection('liveOps').where(field,'==',value).get()).size,0);
 assert.equal((await db.doc(`liveClasses/${c.id}/private/entry`).get()).exists,false);
 await assert.rejects(()=>call('replacement','getSession',{sessionId:s.id}));
 await assert.rejects(()=>call('student','resolveClassEntry',{code}));
 assert.equal((await call('teacher','deleteClass',{classId:c.id,confirm:true})).deleted,true);

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
