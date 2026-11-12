// npm run build && node --test *.test.mjs (no live API calls)
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {validAccessCode} from './lib/access.js';
import {explainProviderError} from './lib/provider-error.js';
function fixture() {
 const counts={image:500,copy:500}, stats={gates:0,paid:0};
 const db={doc:path=>({path,set:async value=>{for(const k of Object.keys(value))counts[k]++;}}),runTransaction:async fn=>{stats.gates++;return fn({get:async()=>({data:()=>({bucket:Math.floor(Date.now()/600000),count:60})}),set:()=>{}});}};
 const context=vm.createContext({initializeApp:()=>{},handleAdmin:()=>{throw Error('unexpected admin call');},generationSettings:async()=>({imagePrompt:'test image',copyPrompt:'test copy'}),createHmac,validAccessCode,getFirestore:()=>db,FieldValue:{increment:n=>n},onRequest:(_opts,fn)=>fn,defineSecret:name=>({value:()=>name==='SPIKE_ACCESS_CODE'?'classroom-test-code':'dummy-key'}),z,explainProviderError,AbortSignal,console,fetch:async()=>{stats.paid++;return {ok:true,json:async()=>({data:[{b64_json:'fixture'}],output:[{content:[{type:'output_text',text:'{"title":"테스트","subtitle":"문구"}'}]}]})};}});
 const source=readFileSync(new URL('./lib/index.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export const spikeApi','const spikeApi');
 vm.runInContext(source+'\nglobalThis.handler=spikeApi;',context);
 async function call(kind,code='classroom-test-code'){
  const response={statusCode:200,set:()=>{},status(n){this.statusCode=n;return this;},json(value){this.body=value;},end(){}};
  await context.handler({method:'POST',headers:{origin:'https://spike-studio-0361kr.web.app','x-participation-code':code},ip:'shared-school-ip',body:{kind,instruction:'배구 홍보',draft:{team:'배구부',title:'',subtitle:''}}},response);
  return response;
 }
 return {call,counts,stats};
}
test('image and copy exceed old daily caps and shared-IP cap, while counts continue',async()=>{const f=fixture();assert.equal((await f.call('image')).statusCode,200);assert.equal((await f.call('copy')).statusCode,200);assert.equal(f.counts.image,501);assert.equal(f.counts.copy,501);assert.equal(f.stats.gates,0);assert.equal(f.stats.paid,2);});
test('valid participation verification does not consume generation or IP allowances',async()=>{const f=fixture();assert.equal((await f.call('verify')).statusCode,200);assert.equal(f.stats.gates,0);assert.equal(f.stats.paid,0);assert.equal(f.counts.image,500);});
test('incorrect codes still hit the failed-access throttle and never the provider',async()=>{const f=fixture();assert.equal((await f.call('image','incorrect-code')).statusCode,429);assert.equal(f.stats.paid,0);assert.equal(f.stats.gates,1);});
