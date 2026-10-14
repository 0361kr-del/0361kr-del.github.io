import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultNewspaper,newspaperSchema,activityTime} from '../shared/newspaper';
test('newspaper defaults and bounded text',()=>{assert.deepEqual(defaultNewspaper(),{title:'남산 뉴스',label:'AI 인터뷰',footer:'인터뷰로 만난 생각, 나의 언어로 쓴 이야기'});assert.equal(newspaperSchema.safeParse({title:'x'.repeat(61)}).success,false);});
test('activity timestamp is stable Seoul time, not last edit time',()=>{const createdAt=Date.UTC(2026,9,13,5,30);assert.match(activityTime({createdAt,updatedAt:createdAt+86400000,messages:[]}),/14:30/);assert.match(activityTime({updatedAt:createdAt,messages:[]}),/기록 없음/);});
