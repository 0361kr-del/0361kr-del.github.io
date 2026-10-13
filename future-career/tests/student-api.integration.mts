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
  const result=body.text.format.name==='interview_question'?{acknowledgement:'알겠습니다.',question:'어떤 경험을 했나요?'}:{title:'미래의 일',subtitle:'가상 인터뷰',body:'[교육용 AI 인터뷰] 바다를 관찰했다.',quotes:['없는 수상 경력을 지어냈습니다.','바다를 관찰했습니다.']};
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}],usage:{input_tokens:100,output_tokens:50}}));
}) as typeof fetch;
const call=(uid:string,method:string,payload:Record<string,unknown>={},requestId=crypto.randomUUID())=>studentApi.run({auth:{uid,token:{}},data:{method,payload,requestId},rawRequest:{},app:{appId:'test'}} as never) as Promise<any>;
before(async()=>{await db.doc('teachers/teacher').set({active:true});await db.doc('siteConfig/ai').set({ai:{model:'gpt-5.4-mini-2026-03-17',interviewSystemPrompt:'저장된 인터뷰 본문',articleSystemPrompt:'저장된 기사 본문'}});});
after(async()=>{globalThis.fetch=originalFetch;await db.terminate();await deleteApp(app);});
test('legacy bundled defaults upgrade without overwriting owner customization',async()=>{
 const {getGlobalAi}=await import('../functions/src/ai-policy.ts');
 const {LEGACY_INTERVIEW_PROMPT,LEGACY_ARTICLE_PROMPT}=await import('../shared/legacy-ai-defaults.ts');
 const {DEFAULT_INTERVIEW_PROMPT,DEFAULT_ARTICLE_PROMPT}=await import('../shared/ai-settings.ts');
 const ref=db.doc('siteConfig/ai'),previous=(await ref.get()).data()!;
 try {
  await ref.set({ai:{interviewSystemPrompt:LEGACY_INTERVIEW_PROMPT,articleSystemPrompt:LEGACY_ARTICLE_PROMPT}});
  const upgraded=await getGlobalAi();assert.equal(upgraded.interviewSystemPrompt,DEFAULT_INTERVIEW_PROMPT);assert.equal(upgraded.articleSystemPrompt,DEFAULT_ARTICLE_PROMPT);
  await ref.set({ai:{interviewSystemPrompt:'소유자가 만든 독서 인터뷰',articleSystemPrompt:'소유자가 만든 기사 지침'}});
  assert.equal((await getGlobalAi()).interviewSystemPrompt,'소유자가 만든 독서 인터뷰');
 }finally{await ref.set(previous);}
});
test('only the pinned owner changes global AI policy; class tampering cannot override it',async()=>{
 const {OWNER_UID}=await import('../functions/src/ai-policy.ts');
 await db.doc(`teachers/${OWNER_UID}`).set({active:true});
 const original=(await call('teacher','getGlobalAi')).ai;
 await assert.rejects(()=>call('teacher','saveGlobalAi',{ai:original}));
 await assert.rejects(()=>call('anonymous-new','getGlobalAi'));
 const policy={...original,interviewSystemPrompt:'소유자 정책'};
 assert.equal((await call(OWNER_UID,'saveGlobalAi',{ai:policy})).ai.interviewSystemPrompt,'소유자 정책');
 const malicious={...original,model:'gpt-4.1-mini-2025-04-14',interviewSystemPrompt:'임의 교사 정책',interviewInstructions:'우주 직업을 탐구'};
 const c=(await call('teacher','createClass',{title:'정책 검증',classroom:'1',objective:'탐구',ai:malicious})).classRecord;
 assert.equal(c.ai.interviewSystemPrompt,'소유자 정책');assert.equal(c.ai.model,policy.model);assert.equal(c.ai.interviewInstructions,malicious.interviewInstructions);
 const updated=(await call('teacher','updateClassAi',{classId:c.id,ai:malicious})).classRecord;
 assert.equal(updated.ai.interviewSystemPrompt,'소유자 정책');
 await call(OWNER_UID,'saveGlobalAi',{ai:original});
});
test('verified Google teachers enroll once, own only their classes and cannot undo suspension',async()=>{
 const {enrollGoogleTeacher}=await import('../functions/src/teacher-access.ts');
 const google={firebase:{sign_in_provider:'google.com'},email_verified:true};
 assert.equal(await enrollGoogleTeacher('anonymous-new',{firebase:{sign_in_provider:'anonymous'}}),false);
 assert.equal(await enrollGoogleTeacher('unverified-new',{...google,email_verified:false}),false);
 assert.equal(await enrollGoogleTeacher('password-new',{...google,firebase:{sign_in_provider:'password'}}),false);
 assert.equal((await db.doc('teachers/anonymous-new').get()).exists,false);
 const results=await Promise.all([enrollGoogleTeacher('google-new',google),enrollGoogleTeacher('google-new',google)]);assert.deepEqual(results,[true,true]);
 const c=(await call('google-new','createClass',{title:'동료 교사',classroom:'2',objective:'테스트'})).classRecord;
 assert.ok((await call('google-new','listClasses')).classes.some((v:any)=>v.id===c.id));
 assert.equal((await call('teacher','listClasses')).classes.some((v:any)=>v.id===c.id),false);
 await assert.rejects(()=>call('teacher','listSessions',{classId:c.id}));
 await db.doc('teachers/google-new').update({active:false});
 assert.equal(await enrollGoogleTeacher('google-new',google),false);
 await assert.rejects(()=>call('google-new','createClass',{title:'차단',classroom:'2',objective:'테스트'}));
 const enrolled=await studentApi.run({auth:{uid:'google-callable',token:google},data:{method:'teacherStatus',payload:{},requestId:crypto.randomUUID()},rawRequest:{},app:{appId:'test'}} as never) as any;
 assert.equal(enrolled.active,true);
});
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
 assert.equal(second.settings.ai.model,ai.model);assert.equal(second.settings.ai.interviewSystemPrompt,ai.interviewSystemPrompt);
 await assert.rejects(()=>call('intruder','getSession',{sessionId:s.id}));
 const duplicate=(await call('intruder','joinClassByQr',{code,student})).session;assert.notEqual(duplicate.id,s.id);
 await assert.rejects(()=>call('intruder','getSession',{sessionId:s.id}));
 const joinId=crypto.randomUUID();const fresh=(await call('student','joinClassByQr',{code,student},joinId)).session;assert.notEqual(fresh.id,s.id);assert.equal((await call('student','joinClassByQr',{code,student},joinId)).session.id,fresh.id);
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
 await db.doc(`liveAiJobs/${s.id}-article`).set({status:'failed',code:'AI_UNSUPPORTED_QUOTE',attempts:3});
 let {article:a}=await call('student','generateArticle',{sessionId:s.id});const beforeCalls=providerCalls;
 assert.deepEqual((await call('student','generateArticle',{sessionId:s.id})).article.original,a.original);assert.equal(providerCalls,beforeCalls);
 assert.ok(!a.original.body.includes('없는 수상'));assert.ok(a.original.body.includes('“바다를 관찰했습니다.”'));
 const original=a.original,content={...a.edited,title:'내가 수정한 제목'};
 a=(await call('student','saveArticle',{sessionId:s.id,content,expectedRevision:a.revision})).article;
 assert.deepEqual(a.original,original);
 await assert.rejects(()=>call('student','saveArticle',{sessionId:s.id,content,expectedRevision:0}));
 a=(await call('student','submitArticle',{sessionId:s.id,content,expectedRevision:a.revision})).article;
 await assert.rejects(()=>call('student','saveArticle',{sessionId:s.id,content,expectedRevision:a.revision}));
 assert.equal((await call('teacher','getArticle',{sessionId:s.id})).article.submitted.title,content.title);
 await assert.rejects(()=>call('intruder','getArticle',{sessionId:s.id}));
 for(let round=0;round<2;round++){
  s=(await call('student','getSession',{sessionId:s.id})).session;
  const req=crypto.randomUUID(),payload={sessionId:s.id,expectedRevision:s.revision};
  await assert.rejects(()=>call('intruder','reopenInterview',payload));
  s=(await call('student','reopenInterview',payload,req)).session;
  assert.equal((await call('student','reopenInterview',payload,req)).session.revision,s.revision);
  if(s.awaitingQuestion)s=(await call('student','continueInterview',{sessionId:s.id})).session;
  s=(await call('student','sendAnswer',{sessionId:s.id,text:'추가 답변',questionId:s.currentQuestionId,expectedRevision:s.revision})).session;
  if(s.status==='INTERVIEWING')s=(await call('student','finishInterview',{sessionId:s.id,expectedRevision:s.revision})).session;
 }
 assert.equal(s.answerCount,5);assert.equal(s.continuationCount,2);
 assert.deepEqual((await call('student','getArticle',{sessionId:s.id})).article.submitted,a.submitted);

 const {code:recovery}=await call('teacher','issueRecovery',{sessionId:s.id});
 assert.equal((await call('replacement','redeemRecovery',{code:recovery})).session.id,s.id);
 await assert.rejects(()=>call('student','getSession',{sessionId:s.id}));
 await assert.rejects(()=>call('intruder','redeemRecovery',{code:recovery}));
 assert.equal((await call('replacement','redeemRecovery',{code:recovery})).session.id,s.id);
 await call('teacher','setClassState',{classId:c.id,status:'CLOSED'});
 await assert.rejects(()=>call('replacement','reopenInterview',{sessionId:s.id,expectedRevision:s.revision}));
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
test('independent activities preserve previous data and recover only the chosen activity',async()=>{
 const {classRecord:c,code}=await call('teacher','createClass',{title:'여러 회차',classroom:'5',objective:'직업 탐구'});
 const {session:first}=await call('attempt-user','joinClassByQr',{code,student:{name:'가상',number:1,career:'연구원',noticeAccepted:true}});
 // Old deployed memberships without the new history fields also migrate correctly.
 await db.doc(`liveClasses/${c.id}/members/1`).set({sessionId:first.id});
 const original={title:'보존할 제출본',subtitle:'가상',body:'기존 기사'};
 await db.doc(`liveArticles/${first.id}`).set({sessionId:first.id,original,edited:original,submitted:original,revision:1});
 const payload={sessionId:first.id,career:'요리사',expectedRevision:first.revision};
 await assert.rejects(()=>call('intruder','startNewInterview',payload));
 const requestId=crypto.randomUUID();let next=(await call('attempt-user','startNewInterview',payload,requestId)).session;
 assert.notEqual(next.id,first.id);assert.equal(next.attempt,2);assert.equal(next.messages.length,0);assert.equal(next.career,'요리사');
 assert.equal((await call('attempt-user','startNewInterview',payload,requestId)).session.id,next.id);
 await assert.rejects(()=>call('attempt-user','startNewInterview',payload));
 assert.equal((await call('attempt-user','resume',{classId:c.id})).session.id,next.id);
 assert.deepEqual((await call('attempt-user','getArticle',{sessionId:first.id})).article.submitted,original);
 assert.equal((await db.doc(`liveClasses/${c.id}`).get()).data()!.studentCount,2);
 assert.equal((await call('teacher','listSessions',{classId:c.id})).sessions.length,2);
 await assert.rejects(()=>call('intruder','listMySessions',{sessionId:first.id}));
 for(let i=3;i<=5;i++)next=(await call('attempt-user','startNewInterview',{sessionId:next.id,career:'직업 '+i,expectedRevision:next.revision})).session;
 assert.equal((await call('attempt-user','listMySessions',{sessionId:next.id})).sessions.length,5);
 next=(await call('attempt-user','startNewInterview',{sessionId:next.id,career:'추가',expectedRevision:next.revision})).session;assert.equal(next.attempt,6);
 const firstRecovery=await call('teacher','issueRecovery',{sessionId:first.id});assert.ok(firstRecovery.code);
 const recovery=await call('teacher','issueRecovery',{sessionId:next.id});
 await call('attempt-device','redeemRecovery',{code:recovery.code});
 assert.equal((await call('attempt-device','listMySessions',{sessionId:next.id})).sessions.length,1);
 await assert.rejects(()=>call('attempt-device','getArticle',{sessionId:first.id}));
 assert.deepEqual((await call('attempt-user','getArticle',{sessionId:first.id})).article.submitted,original);
 await call('teacher','deleteClass',{classId:c.id,confirm:true});
 assert.equal((await db.collection('liveSessions').where('classId','==',c.id).get()).size,0);
 assert.equal((await db.doc(`liveArticles/${first.id}`).get()).exists,false);
});
test('reference numbers and legacy capacity never restrict entry',async()=>{
 const {classRecord:c,code}=await call('teacher','createClass',{title:'정원 없음',classroom:'1',objective:'탐구',maxStudents:1});
 for(let i=0;i<3;i++)assert.ok((await call('capacity-'+i,'joinClassByQr',{code,student:{name:'별명',number:99,career:'연구원',noticeAccepted:true}})).session.id);
 assert.equal((await call('teacher','listSessions',{classId:c.id})).sessions.length,3);
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
