import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classInput, startSession, finishSession } from '../shared/domain';
import { saveLiveAnswer, attachQuestion, reopenInterview, type LiveSession } from '../shared/live';
const now=Date.now();
const c={...classInput.parse({title:'가상 수업',classroom:'1',objective:'진로 탐색'}),id:'c',teacherUid:'t',status:'OPEN' as const,studentCount:0,createdAt:now,retainUntil:now+100000};
const fresh=()=>startSession('s',c,{name:'가상별명',number:1,grade:6,classroom:'1',career:'연구원',noticeAccepted:true},'u',now);
test('answer is saved independently of a generated follow-up and no fixture leaks',()=>{
  const s=saveLiveAnswer(fresh(),{text:'바다를 연구합니다.',questionId:'q-1',expectedRevision:0},'u',now);
  assert.equal(s.messages.at(-1)?.role,'student');assert.equal(s.answerCount,1);assert.equal(s.awaitingQuestion,true);assert.equal(s.currentQuestionId,'');
  assert.throws(()=>saveLiveAnswer(s,{text:'중복',questionId:'q-1',expectedRevision:0},'u',now),/AI_REQUEST_PENDING/);
  const next=attachQuestion(s,'u',s.revision,'어떤 생물을 관찰했나요?',now);
  assert.equal(next.messages.at(-1)?.text,'어떤 생물을 관찰했나요?');assert.equal(next.currentQuestionId,'q-2');assert.equal(next.awaitingQuestion,false);
  assert.throws(()=>attachQuestion(next,'u',s.revision,'중복 질문',now),/REVISION_CONFLICT/);
});
test('other actors, expired sessions and stale generation cannot mutate an interview',()=>{
  const s=saveLiveAnswer(fresh(),{text:'답변',questionId:'q-1',expectedRevision:0},'u',now);
  assert.throws(()=>attachQuestion(s,'other',s.revision,'질문',now),/ACCESS_DENIED/);
  assert.throws(()=>attachQuestion(s,'u',s.revision,'질문',c.retainUntil+1),/ACCESS_DENIED/);
});
test('can finish after three saved answers without paying for another question',()=>{
  let s=fresh();for(let i=0;i<3;i++){s=saveLiveAnswer(s,{text:'가상 답변',questionId:s.currentQuestionId,expectedRevision:s.revision},'u',now);if(i<2)s=attachQuestion(s,'u',s.revision,'질문',now);}
  assert.equal(finishSession(s,'u',s.revision,now).status,'INTERVIEW_COMPLETED');
});

test('completed interviews reopen repeatedly without dropping history and stop at 24 answers',()=>{
 let s:LiveSession=fresh();
 for(let i=0;i<24;i++){
  if(s.status==='INTERVIEW_COMPLETED')s=reopenInterview(s,'u',s.revision,now);
  if(s.awaitingQuestion)s=attachQuestion(s,'u',s.revision,'추가 질문',now);
  s=saveLiveAnswer(s,{text:'답변 '+i,questionId:s.currentQuestionId,expectedRevision:s.revision},'u',now);
 }
 assert.equal(s.status,'INTERVIEW_COMPLETED');assert.equal(s.answerCount,24);
 assert.equal(s.messages.filter(m=>m.role==='student').length,24);assert.equal(s.settings.questionLimit,8);
 assert.ok((s.continuationCount||0)>1);assert.throws(()=>reopenInterview(s,'u',s.revision,now),/INTERVIEW_TOTAL_LIMIT/);
});
test('early finish reuses the unanswered question and rejects unauthorized or stale reopen',()=>{
 let s:LiveSession=fresh();for(let i=0;i<3;i++){s=saveLiveAnswer(s,{text:'답변',questionId:s.currentQuestionId,expectedRevision:s.revision},'u',now);s=attachQuestion(s,'u',s.revision,'질문',now);}
 s={...finishSession(s,'u',s.revision,now),articleState:'submitted'};
 assert.throws(()=>reopenInterview(s,'other',s.revision,now),/ACCESS_DENIED/);
 assert.throws(()=>reopenInterview(s,'u',s.revision-1,now),/REVISION_CONFLICT/);
 const next=reopenInterview(s,'u',s.revision,now);assert.equal(next.currentQuestionId,'q-4');assert.equal(next.awaitingQuestion,false);assert.equal(next.articleState,'submitted');assert.deepEqual(next.messages,s.messages);
});
