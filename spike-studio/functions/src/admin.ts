import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
import type {Request,Response} from 'express';
import {DEFAULT_PROMPTS,generationSettings,isOwner,saveSchema} from './settings.js';
function diagnostic(error:unknown,operation:string) {
 const e=error as {code?:unknown;name?:string};
 const codes:Record<string,string>={'7':'PERMISSION_DENIED','permission-denied':'PERMISSION_DENIED','5':'NOT_FOUND','not-found':'NOT_FOUND','9':'FAILED_PRECONDITION','failed-precondition':'FAILED_PRECONDITION','14':'UNAVAILABLE','unavailable':'UNAVAILABLE','4':'TIMEOUT','deadline-exceeded':'TIMEOUT','8':'RESOURCE_EXHAUSTED','resource-exhausted':'RESOURCE_EXHAUSTED'};
 const reason=e?.name==='ZodError'?'INVALID_SETTINGS':codes[String(e?.code)]||'INTERNAL';
 const code=operation+'_'+reason;
 console.error(JSON.stringify({event:'admin_error',operation,code}));
 return code;
}
const origins=['https://spike-studio-0361kr.web.app','https://spike-studio-0361kr.firebaseapp.com'];
export async function handleAdmin(req:Request,res:Response) {
 res.set('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method)){res.status(405).end();return;}
 if(req.method==='POST'&&!origins.includes(req.headers.origin||'')){res.status(403).json({error:'관리자 사이트에서 요청해 주세요.'});return;}
 const bearer=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
 if(!bearer){res.status(401).json({error:'관리자 Google 로그인이 필요합니다.'});return;}
 try {
  const token=await getAuth().verifyIdToken(bearer,true);
  if(!isOwner(token)){res.status(403).json({error:'사이트 소유자만 관리할 수 있습니다.'});return;}
 } catch {res.status(401).json({error:'로그인이 만료되었습니다. 다시 로그인해 주세요.'});return;}
 let operation='SETTINGS_READ';
 try {
  if(req.method==='GET'){
   const settings=await generationSettings();
   let rows:{date:string;image:number;copy:number}[]=[],usageWarning:string|null=null;
   try {const usage=await getFirestore().collection('usage').orderBy(FieldPath.documentId(),'desc').limit(30).get();rows=usage.docs.map(d=>({date:d.id,image:Number(d.data().image||0),copy:Number(d.data().copy||0)}));}
   catch(e){usageWarning='사용량을 불러오지 못했습니다. 지침 편집은 가능합니다. (진단: '+diagnostic(e,'USAGE_READ')+')';}
   res.json({settings,defaults:DEFAULT_PROMPTS,models:{image:'gpt-image-2.5-flare',copy:'gpt-4.1-mini'},usage:rows,usageWarning,limits:{daily:null,validParticipantIP:null}});return;
  }
  operation='SETTINGS_SAVE';
  const parsed=saveSchema.safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'각 지침을 1~6,000자로 입력해 주세요.'});return;}
  const db=getFirestore(),ref=db.doc('adminSettings/generation');
  const saved=await db.runTransaction(async tx=>{
   const current=(await tx.get(ref)).data();
   if((current?.version||0)!==parsed.data.version)return false;
   const next={imagePrompt:parsed.data.imagePrompt,copyPrompt:parsed.data.copyPrompt,version:parsed.data.version+1,updatedAt:new Date().toISOString()};
   tx.set(ref,next);return next;
  });
  if(!saved){res.status(409).json({error:'다른 화면에서 설정이 변경됐습니다. 새로고침 후 다시 저장해 주세요.'});return;}
  res.json({settings:saved});
 }catch(e){const code=diagnostic(e,operation);res.status(500).json({error:'관리자 설정을 처리하지 못했습니다. (진단: '+code+')',code});}
}
