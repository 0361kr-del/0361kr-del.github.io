import {getFirestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {isSiteOwner} from './ai-policy.js';
import {AI_MODELS} from '../../shared/ai-settings.js';
export async function getSystemUsage(uid:string) {
 if(!isSiteOwner(uid))throw new HttpsError('permission-denied','ACCESS_DENIED');
 const db=getFirestore(),now=Date.now();
 const days=Array.from({length:7},(_,i)=>new Date(now-i*86400000).toISOString().slice(0,10));
 const count=async(c:string,field?:string,value?:unknown)=>{const q=field?db.collection(c).where(field,'==',value):db.collection(c);return (await q.count().get()).data().count;};
 const [teachers,activeTeachers,classes,sessions,submitted,rows,jobs,previews,budgets,quotas]=await Promise.all([
 count('teachers'),count('teachers','active',true),count('liveClasses'),count('liveSessions'),count('liveSessions','articleState','submitted'),
 db.collection('liveClasses').orderBy('createdAt','desc').limit(50).select('title','teacherUid','status','createdAt','studentCount').get(),
 db.collection('liveAiJobs').orderBy('createdAt','desc').limit(500).select('status','model','usage','createdAt').get(),
 db.collection('aiPreviewOperations').orderBy('createdAt','desc').limit(500).select('status','result.model','result.usage','createdAt').get(),
 db.getAll(...days.map(day=>db.doc(`liveBudget/${day}`))),db.getAll(...days.map(day=>db.doc(`aiPreviewQuotas/${day}-project`)))
 ]);
 const models:Record<string,{calls:number;inputTokens:number;outputTokens:number;estimatedUsd:number}>={};let failed=0,pending=0;
 for(const doc of [...jobs.docs,...previews.docs]){const d=doc.data();if(d.status==='failed')failed++;if(d.status==='pending')pending++;const result=d.result||d;if(d.status!=='done'||!result.usage)continue;const model=String(result.model||'unknown');const m=models[model]??={calls:0,inputTokens:0,outputTokens:0,estimatedUsd:0};m.calls++;const input=Number(result.usage.inputTokens)||0,output=Number(result.usage.outputTokens)||0;m.inputTokens+=input;m.outputTokens+=output;const price=AI_MODELS[model as keyof typeof AI_MODELS];if(price)m.estimatedUsd+=(input*price.input+output*price.output)/1e6;}
 return {generatedAt:now,totals:{teachers,activeTeachers,classes,sessions,submitted},days:days.map((day,i)=>({day,studentCalls:budgets[i].data()?.count||0,previewCalls:quotas[i].data()?.count||0,reservedUsd:(budgets[i].data()?.reservedMicros||0)/1e6})),models,jobSample:{student:jobs.size,preview:previews.size,failed,pending},classes:rows.docs.map(d=>({id:d.id,...d.data()}))};
}
