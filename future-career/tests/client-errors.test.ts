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
