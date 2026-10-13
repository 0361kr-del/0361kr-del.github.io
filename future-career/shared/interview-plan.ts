import {z} from 'zod';
export const interviewPlanSchema=z.object({
 version:z.literal(2),topic:z.string().trim().min(1).max(200),
 mode:z.enum(['experience','roleplay','inquiry']).default('inquiry'),
 mainCount:z.number().int().min(3).max(10).default(6),
 followupLimit:z.number().int().min(0).max(2).default(2),
 questions:z.array(z.string().trim().min(1).max(300)).max(10).default([]),
 articleFocus:z.string().trim().max(500).default(''),
}).strict().refine(p=>p.questions.length===0||p.questions.length===p.mainCount,{message:'핵심 질문을 직접 입력할 때는 주요 질문 수와 줄 수를 맞춰 주세요.'});
export type InterviewPlan=z.infer<typeof interviewPlanSchema>;
export const stageSchema=z.enum(['INTRO','WARMUP','MAIN','CLOSING','END']);
export const assessmentSchema=z.enum(['sufficient','needs_detail','skip']);
export const guidedSchema=z.object({version:z.literal(2),pendingAssessment:z.boolean().default(false),stage:stageSchema,mainIndex:z.number().int().min(0).max(16),target:z.number().int().min(3).max(16),followups:z.number().int().min(0).max(2),outcomes:z.array(z.enum(['answered','skipped','followup_limit'])).max(16)});
export type GuidedProgress=z.infer<typeof guidedSchema>;
export const MAX_GUIDED_ANSWERS=48;
export const startGuided=(p:InterviewPlan):GuidedProgress=>({version:2,pendingAssessment:false,stage:'INTRO',mainIndex:0,target:p.mainCount,followups:0,outcomes:[]});
export function nextGuided(g:GuidedProgress,p:InterviewPlan,assessment:z.infer<typeof assessmentSchema>,hasAnswer:boolean):GuidedProgress {
 if(!hasAnswer)return g;
 if(g.stage==='INTRO')return {...g,stage:'WARMUP'};
 if(g.stage==='WARMUP')return {...g,stage:'MAIN',mainIndex:1};
 if(g.stage==='CLOSING')return {...g,stage:'END'};
 if(g.stage==='END')return g;
 if(assessment==='needs_detail'&&g.followups<p.followupLimit)return {...g,followups:g.followups+1};
 const outcome=assessment==='sufficient'?'answered':assessment==='skip'?'skipped':'followup_limit';
 return {...g,outcomes:[...g.outcomes,outcome],followups:0,stage:g.mainIndex>=g.target?'CLOSING':'MAIN',mainIndex:g.mainIndex>=g.target?g.mainIndex:g.mainIndex+1};
}
export const explicitlyDeclines=(text:string)=>/말하고\s*싶지|답하고\s*싶지|답변하고\s*싶지|건너\s*뛰|패스할|대답하기\s*싫/.test(text);
