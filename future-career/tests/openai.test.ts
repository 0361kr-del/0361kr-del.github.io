import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAiError } from '../shared/ai-errors';
import { buildAiRequest, generateWithOpenAI } from '../functions/src/openai';
const input={kind:'question',career:'바다 연구원',futureYear:2040,questionLimit:8,transcript:[{role:'student',text:'산호를 관찰합니다.'}],fictionalDataConfirmed:true} as const;
const request=()=>JSON.parse(JSON.stringify(input));
test('diagnostics distinguish provider failures without disclosing arbitrary errors',async()=>{
  for(const [status,code] of [[400,'AI_REQUEST_REJECTED'],[403,'AI_ACCESS_FORBIDDEN'],[404,'AI_MODEL_UNAVAILABLE'],[503,'AI_PROVIDER_ERROR']] as const){
    await assert.rejects(()=>generateWithOpenAI(request(),'test-only',(async()=>new Response('private provider body',{status})) as typeof fetch),new RegExp(code));
  }
  assert.equal(safeAiError(new Error('private provider body')), 'AI_UNAVAILABLE');
  assert.equal(safeAiError(new Error('AI_ACCESS_FORBIDDEN')), 'AI_ACCESS_FORBIDDEN');
  assert.equal(safeAiError(new Error('toString')), 'AI_UNAVAILABLE');
});
test('surrounding whitespace in a secret is removed and network failure is safe',async()=>{
  await assert.rejects(()=>generateWithOpenAI(request(),' test-only\n',(async(_url,init)=>{
    assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-only');
    throw new Error('private network detail');
  }) as typeof fetch),/AI_NETWORK_ERROR/);
});
const response=(content:unknown,status='completed')=>new Response(JSON.stringify({status,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(content)}]}],usage:{input_tokens:20,output_tokens:10}}));
test('server request disables storage and carries context without identity fields',()=>{const body=buildAiRequest(request());assert.equal(body.store,false);assert.ok(body.input.includes('산호'));assert.ok(!body.input.includes('fictionalDataConfirmed'));assert.equal(body.text.format.strict,true);assert.equal(body.max_output_tokens,500);});
test('valid structured question is parsed; key is only in authorization header',async()=>{let calls=0;const fetcher=async(url:unknown,init:RequestInit|undefined)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-only');assert.ok(!String(init?.body).includes('test-only'));return response({acknowledgement:'산호를 관찰하는군요.',question:'관찰 중 어려웠던 일은 무엇인가요?'});};const result=await generateWithOpenAI(request(),'test-only',fetcher as typeof fetch);assert.equal(result.kind,'question');assert.equal(calls,1);});
test('contact data rejected before any provider request',async()=>{const p=request();p.transcript[0].text='전화 010-1234-5678';let calls=0;await assert.rejects(()=>generateWithOpenAI(p,'test-only',(async()=>{calls++;return response({});}) as typeof fetch),/PERSONAL_DATA_DETECTED/);assert.equal(calls,0);});
test('invalid key and rate limits fail safely without response body leaks or automatic retries',async()=>{for(const [status,code] of [[401,'AI_KEY_INVALID'],[429,'AI_RATE_LIMIT']] as const){let calls=0;await assert.rejects(()=>generateWithOpenAI(request(),'test-only',(async()=>{calls++;return new Response('sensitive-provider-error',{status});}) as typeof fetch),new RegExp(code));assert.equal(calls,1);}});
test('article keeps exact student quotes, omits unsupported quotes and never retries the provider',async()=>{
 const p=request();p.kind='article';p.transcript=[{role:'student',text:'바다를 연구해요.'},{role:'student',text:'수영을 배웠어요.'},{role:'student',text:'동료와 해결했어요.'},{role:'reporter',text:'기자만 한 말'}];
 let calls=0;
 const out=await generateWithOpenAI(p,'test-only',(async()=>{calls++;return response({title:'제목',subtitle:'부제',body:'가상 기사',quotes:['대상을 수상했습니다.','바다를 연구해요.','기자만 한 말']});}) as typeof fetch);
 assert.ok('quotes' in out.result);if('quotes' in out.result)assert.deepEqual(out.result.quotes,['바다를 연구해요.']);assert.equal(calls,1);
 const empty=await generateWithOpenAI(p,'test-only',(async()=>response({title:'제목',subtitle:'',body:'기사 본문',quotes:['지어낸 인용']})) as typeof fetch);
 if('quotes' in empty.result)assert.deepEqual(empty.result.quotes,[]);
 await assert.rejects(()=>generateWithOpenAI(request(),'test-only',(async()=>response({},'incomplete')) as typeof fetch),/AI_INCOMPLETE/);
});
test('teacher configuration selects allowlisted model while retaining fixed safety and bounded output',()=>{
 const configured={...request(),grade:6,objective:'환경과 직업',ai:{model:'gpt-5.4-mini-2026-03-17',tone:'차분한 기자',interviewInstructions:'환경 보호 경험을 물어봐 주세요.',articleInstructions:'사회 기여를 정리해 주세요.'}};
 const body=buildAiRequest(configured);
 assert.equal(body.model,configured.ai.model);assert.deepEqual(body.reasoning,{effort:'none'});
 assert.ok(body.instructions.includes('환경 보호 경험'));assert.ok(body.instructions.includes('개인의 실제 이름'));assert.ok(body.instructions.includes('환경과 직업'));
 assert.ok(!body.instructions.includes('사회 기여를 정리'));assert.equal(body.max_output_tokens,500);
 assert.throws(()=>buildAiRequest({...configured,ai:{...configured.ai,model:'arbitrary-expensive-model'}}));
 assert.throws(()=>buildAiRequest({...configured,ai:{...configured.ai,interviewInstructions:'x'.repeat(1001)}}));
 assert.equal(buildAiRequest(request()).model,'gpt-4.1-mini-2025-04-14');
});
test('edited system prompts replace task defaults, are routed by stage, and reject blank or oversized values',()=>{
 const ai={interviewSystemPrompt:'교사 인터뷰 본문: 먼저 직업을 고른 이유를 물어보세요.',articleSystemPrompt:'교사 기사 본문: 두 문단으로 작성하세요.'};
 const question=buildAiRequest({...request(),ai});
 assert.ok(question.instructions.startsWith(ai.interviewSystemPrompt));
 assert.ok(!question.instructions.includes('첫 질문은 직업에서 하는 일을 묻습니다.'));
 assert.ok(!question.instructions.includes(ai.articleSystemPrompt));
 const article=buildAiRequest({...request(),kind:'article',transcript:Array.from({length:3},()=>({role:'student',text:'산호를 관찰합니다.'})),ai});
 assert.ok(article.instructions.startsWith(ai.articleSystemPrompt));
 assert.ok(!article.instructions.includes('3~5문단'));assert.ok(article.instructions.includes('서버 필수 규칙'));
 for(const prompt of ['', '  ', 'x'.repeat(6001)])assert.throws(()=>buildAiRequest({...request(),ai:{...ai,interviewSystemPrompt:prompt}}));
});

test('general interview accepts no year and never sends a legacy year to AI',()=>{
 const {futureYear,...general}=request();
 const body=buildAiRequest({...general,career:'책 속 인물의 선택'});
 const payload=JSON.parse(body.input);
 assert.equal(payload.topicOrRole,'책 속 인물의 선택');assert.equal('futureYear' in payload,false);
 assert.equal('futureYear' in JSON.parse(buildAiRequest(request()).input),false);
 assert.ok(body.instructions.includes('독서'));assert.ok(!body.instructions.includes('미래 직업 역할극이라는 점을 유지'));
});

test('GPT-6 Luna is opt-in and retains low-latency structured output contract',()=>{
 const body=buildAiRequest({...request(),ai:{model:'gpt-6-luna'}});
 assert.equal(body.model,'gpt-6-luna');assert.deepEqual(body.reasoning,{effort:'none'});assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
 assert.equal(buildAiRequest(request()).model,'gpt-4.1-mini-2025-04-14');
});
