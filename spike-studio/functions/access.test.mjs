import{test}from'node:test';import assert from'node:assert/strict';import{validAccessCode}from'./lib/access.js';
test('shared access rejects missing, short and incorrect codes',()=>{for(const input of [undefined,[], '', '1234','different-code'])assert.equal(validAccessCode(input,'team-access-2026'),false);});
test('shared access matches trimmed code and rejects old code after rotation',()=>{assert.equal(validAccessCode('team-access-2026','team-access-2026\n'),true);assert.equal(validAccessCode('team-access-2026','new-team-code'),false);assert.equal(validAccessCode('short','short'),false);});
