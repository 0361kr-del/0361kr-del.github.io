import { z } from 'zod';
import { aiSettingsSchema, AI_SAFETY_RULES } from '../../shared/ai-settings.js';

export const aiPreviewInput = z.object({
  ai: aiSettingsSchema.default(() => aiSettingsSchema.parse({})),
  grade:z.number().int().min(1).max(12).default(6),
  objective:z.string().trim().max(500).default('주제를 탐구하고 자신의 생각을 구체적으로 표현하기'),
  kind: z.enum(['question', 'article']),
  career: z.string().trim().min(1).max(80),
  futureYear: z.number().int().min(2026).max(2100).optional(),
  questionLimit: z.number().int().min(5).max(24),
  transcript: z.array(z.object({ role:z.enum(['reporter','student']),text:z.string().trim().min(1).max(1000) }).strict()).max(48),
  fictionalDataConfirmed: z.literal(true),
}).strict();
export type AiInput = z.infer<typeof aiPreviewInput>;
const questionResult = z.object({ acknowledgement:z.string().max(180),question:z.string().min(1).max(400) }).strict();
const articleResult = z.object({ title:z.string().min(1).max(120),subtitle:z.string().max(200),body:z.string().min(1).max(8000),quotes:z.array(z.string().min(1).max(1000)).max(3) }).strict();
const schemas = {
  question:{type:'object',properties:{acknowledgement:{type:'string'},question:{type:'string'}},required:['acknowledgement','question'],additionalProperties:false},
  article:{type:'object',properties:{title:{type:'string'},subtitle:{type:'string'},body:{type:'string'},quotes:{type:'array',items:{type:'string'}}},required:['title','subtitle','body','quotes'],additionalProperties:false},
};
export function buildAiRequest(raw: unknown) {
  const input=aiPreviewInput.parse(raw);
  const answers=input.transcript.filter(t=>t.role==='student');
  if(input.kind==='article' && answers.length<3) throw new Error('MINIMUM_ANSWERS');
  if(input.kind==='question' && answers.length>=input.questionLimit) throw new Error('INTERVIEW_LIMIT_REACHED');
  // Obvious contact identifiers are rejected, not silently treated as anonymized.
  if(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|01[016789][ -]?\d{3,4}[ -]?\d{4}|\d{6}[ -]?[1-4]\d{6}/.test(JSON.stringify(input))) throw new Error('PERSONAL_DATA_DETECTED');
  const instruction = input.kind==='question' ? input.ai.interviewSystemPrompt : input.ai.articleSystemPrompt;
  const contract = input.kind==='question'
    ? '출력 형식: acknowledgement는 180자 이하, question은 한 번에 하나의 질문으로 400자 이하입니다.'
    : '출력 형식: title 120자 이하, subtitle 200자 이하, body 8000자 이하입니다. 교육용 AI 인터뷰를 바탕으로 작성했음을 표시하고 역할극이나 상상 내용은 사실로 단정하지 않습니다. quotes는 학생 답변에서 정확히 발췌한 인용 0~3개만 담습니다.';
  return { model:input.ai.model,...(input.ai.model.startsWith('gpt-5')?{reasoning:{effort:'none' as const}}:{}),store:false,instructions:instruction+'\n'+AI_SAFETY_RULES+'\n'+contract+'\n수업 수준: '+input.grade+'학년. 말투: '+input.ai.tone+'\n교사 교육 설정(JSON): '+JSON.stringify({objective:input.objective,additional:input.kind==='question'?input.ai.interviewInstructions:input.ai.articleInstructions}),input:JSON.stringify({topicOrRole:input.career,questionLimit:input.questionLimit,transcript:input.transcript}),max_output_tokens:input.kind==='question'?500:2200,text:{format:{type:'json_schema',name:input.kind==='question'?'interview_question':'interview_article',strict:true,schema:schemas[input.kind]}} };
}
export async function generateWithOpenAI(raw: unknown, apiKey: string, fetcher: typeof fetch=fetch) {
  if(!apiKey.trim()) throw new Error('AI_NOT_CONFIGURED');
  const input=aiPreviewInput.parse(raw),body=buildAiRequest(input);
  const startedAt=Date.now();
  let response: Response;
  try { response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${apiKey.trim()}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)}); }
  catch { throw new Error('AI_NETWORK_ERROR'); }
  if(!response.ok) {
    const codes: Record<number,string> = {400:'AI_REQUEST_REJECTED',401:'AI_KEY_INVALID',403:'AI_ACCESS_FORBIDDEN',404:'AI_MODEL_UNAVAILABLE',429:'AI_RATE_LIMIT'};
    throw new Error(codes[response.status] || (response.status>=500?'AI_PROVIDER_ERROR':'AI_UNAVAILABLE'));
  }
  const data=await response.json() as {status?:string;output?:Array<{type:string;content?:Array<{type:string;text?:string}>}>;usage?:{input_tokens:number;output_tokens:number}};
  if(data.status!=='completed') throw new Error('AI_INCOMPLETE');
  const content=(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]);
  if(content.some(c=>c.type==='refusal')) throw new Error('AI_REFUSED');
  const text=content.filter(c=>c.type==='output_text').map(c=>c.text||'').join('');
  let parsed: unknown;try{parsed=JSON.parse(text);}catch{throw new Error('AI_INVALID_OUTPUT');}
  const checked=input.kind==='question'?questionResult.safeParse(parsed):articleResult.safeParse(parsed);
  if(!checked.success) throw new Error('AI_INVALID_OUTPUT');
  const result=checked.data;
  if('quotes' in result && result.quotes.some(q=>!input.transcript.some(t=>t.role==='student'&&t.text.includes(q)))) throw new Error('AI_UNSUPPORTED_QUOTE');
  return {kind:input.kind,result,durationMs:Date.now()-startedAt,usage:data.usage?{inputTokens:data.usage.input_tokens,outputTokens:data.usage.output_tokens}:null,model:body.model};
}
