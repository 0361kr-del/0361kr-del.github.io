import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classInput, startSession, finishSession } from '../shared/domain';
import { saveLiveAnswer, attachQuestion } from '../shared/live';
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
