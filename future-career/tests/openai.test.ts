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
test('unfounded article quotations and truncated output are rejected',async()=>{const p=request();p.kind='article';p.transcript=[{role:'student',text:'바다를 연구해요.'},{role:'student',text:'수영을 배웠어요.'},{role:'student',text:'동료와 해결했어요.'}];await assert.rejects(()=>generateWithOpenAI(p,'test-only',(async()=>response({title:'제목',subtitle:'부제',body:'가상 기사',quotes:['대상을 수상했습니다.']})) as typeof fetch),/AI_UNSUPPORTED_QUOTE/);await assert.rejects(()=>generateWithOpenAI(request(),'test-only',(async()=>response({},'incomplete')) as typeof fetch),/AI_INCOMPLETE/);});
