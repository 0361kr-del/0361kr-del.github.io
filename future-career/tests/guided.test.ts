import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interviewPlanSchema,startGuided,nextGuided} from '../shared/interview-plan';
import {buildAiRequest} from '../functions/src/openai';
const plan=interviewPlanSchema.parse({version:2,topic:'독서',mainCount:3});
test('followups do not advance main index; bounded attempts and skips advance without claiming sufficiency',()=>{
 let g={...startGuided(plan),stage:'MAIN' as const,mainIndex:1};
 const first=nextGuided(g,plan,'needs_detail',true);assert.equal(first.mainIndex,1);assert.equal(first.outcomes.length,0);
 const second=nextGuided(first,plan,'needs_detail',true);assert.equal(second.mainIndex,1);assert.equal(second.followups,2);
 const exhausted=nextGuided(second,plan,'needs_detail',true);assert.equal(exhausted.mainIndex,2);assert.deepEqual(exhausted.outcomes,['followup_limit']);
 const skipped=nextGuided(exhausted,plan,'skip',true);assert.equal(skipped.mainIndex,3);assert.equal(skipped.outcomes[1],'skipped');
 const closed=nextGuided(skipped,plan,'sufficient',true);assert.equal(closed.stage,'CLOSING');assert.equal(nextGuided(closed,plan,'sufficient',true).stage,'END');
});
test('guided schema enforces teacher question count and AI receives server transitions, not names',()=>{
 assert.equal(interviewPlanSchema.safeParse({...plan,questions:['한 개']}).success,false);
 const guided={...startGuided(plan),stage:'MAIN' as const,mainIndex:1,pendingAssessment:true};
 const body=buildAiRequest({guided,interviewPlan:plan,kind:'question',career:'책 속 인물',questionLimit:48,transcript:[{role:'student',text:'말하고 싶지 않아요'}],fictionalDataConfirmed:true});
 const payload=JSON.parse(body.input);assert.equal(payload.allowedTransitions.needs_detail.mainIndex,2);assert.equal(body.text.format.schema.required.includes('assessment'),true);assert.equal(payload.student_name,undefined);
});

test('server rejects model stage jumps and hard cap remains independent of AI decisions',async()=>{
 const {startSession}=await import('../shared/domain');const {attachQuestion,saveLiveAnswer,reopenInterview}=await import('../shared/live');
 const c={id:'c',title:'수업',classroom:'1',grade:6,maxStudents:23,questionLimit:3,objective:'탐구',teacherUid:'t',status:'OPEN' as const,studentCount:0,createdAt:1,retainUntil:999999,interviewPlan:plan};
 const base={...startSession('s',c,{name:'별명',number:1,grade:6,classroom:'1',career:'독서',noticeAccepted:true},'u',1),messages:[],currentQuestionId:'',awaitingQuestion:true};
 assert.throws(()=>attachQuestion(base,'u',0,'질문',2,{assessment:'sufficient',nextStage:'MAIN',mainIndex:2}),/AI_INVALID_OUTPUT/);
 const ready=attachQuestion(base,'u',0,'소개해 주세요.',2,{assessment:'sufficient',nextStage:'INTRO',mainIndex:0});
 const capped=saveLiveAnswer({...ready,answerCount:47},{text:'마지막 답변',questionId:ready.currentQuestionId,expectedRevision:ready.revision},'u',3);
 assert.equal(capped.status,'INTERVIEW_COMPLETED');assert.equal(capped.awaitingQuestion,false);
 assert.throws(()=>reopenInterview(capped,'u',capped.revision,4),/INTERVIEW_TOTAL_LIMIT/);
});
