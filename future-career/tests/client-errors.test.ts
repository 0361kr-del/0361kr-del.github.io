import { test } from 'node:test';
import assert from 'node:assert/strict';
import {errorText,withRequestContext} from '../shared/client-errors';
test('diagnostics distinguish authentication, transport, server, and input failures',()=>{
 for(const code of ['functions/unauthenticated','functions/internal','functions/deadline-exceeded','INVALID_INPUT','SAFE_INTERNAL_ERROR'])assert.ok(errorText({code}).includes('진단: '+code));
 assert.ok(errorText(withRequestContext(new Error('INVALID_INPUT'),'sendAnswer','12345678-1234-1234-1234-123456789abc')).includes('답변 저장:'));
});
test('unknown diagnostic text cannot disclose arbitrary messages, prototype keys or identifiers',()=>{
 for(const message of ['student private response','toString','oops AI_KEY_INVALID secret'])assert.ok(!errorText({message}).includes(message));
 assert.ok(errorText({code:'functions/internal',action:'private name',requestId:'private student'}).includes('진단: functions/internal'));
 assert.ok(!errorText({requestId:'private student'}).includes('private student'));
 assert.ok(errorText({name:'QuotaExceededError'}).includes('저장 공간'));
});

test('unmapped Firebase SDK codes survive contextual wrapping without exposing error messages',()=>{
 const e=withRequestContext({code:'appCheck/fetch-network-error',message:'private provider text'},'joinClassByQr','277bc7df-888e-4bcc-b717-5b1823c99779');
 const text=errorText(e);assert.ok(text.includes('appCheck/fetch-network-error'));assert.ok(!text.includes('private provider text'));
 assert.ok(errorText(withRequestContext(new TypeError('private text'),'joinClassByQr','')).includes('진단: TypeError'));
 assert.ok(errorText({code:'functions/unknown'}).includes('진단: functions/unknown'));
});

test('structured callable diagnostic survives transport message replacement',()=>{
 const wrapped=withRequestContext({code:'functions/failed-precondition',message:'FAILED_PRECONDITION',details:{diagnosticCode:'AI_UNSUPPORTED_QUOTE'}},'generateArticle','c16a4e6c-032e-4902-99ba-b2b422384a96');
 assert.match(errorText(wrapped),/AI_UNSUPPORTED_QUOTE/);
 assert.ok(!errorText({details:{diagnosticCode:'student private text'}}).includes('student private text'));
});
