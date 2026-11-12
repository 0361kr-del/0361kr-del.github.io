import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
import type {Request,Response} from 'express';
import {DEFAULT_PROMPTS,generationSettings,isOwner,saveSchema} from './settings.js';
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
 try {
  if(req.method==='GET'){
   const [settings,usage]=await Promise.all([generationSettings(),getFirestore().collection('usage').orderBy(FieldPath.documentId(),'desc').limit(30).get()]);
   res.json({settings,defaults:DEFAULT_PROMPTS,models:{image:'gpt-image-2.5-flare',copy:'gpt-4.1-mini'},usage:usage.docs.map(d=>({date:d.id,image:Number(d.data().image||0),copy:Number(d.data().copy||0)})),limits:{daily:null,validParticipantIP:null}});return;
  }
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
 }catch{res.status(500).json({error:'관리자 설정을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'});}
}
