import { useState } from 'react';
import { AI_MODELS, AI_SAFETY_RULES, DEFAULT_INTERVIEW_PROMPT, DEFAULT_ARTICLE_PROMPT, aiSettingsSchema, type AiSettings } from '../shared/ai-settings';
import type { ClassRecord } from '../shared/domain';
export function AiSettingsFields({value,onChange,disabled=false}:{value:AiSettings;onChange:(v:AiSettings)=>void;disabled?:boolean}) {
 const rate=AI_MODELS[value.model];
 return <fieldset disabled={disabled}><legend>AI 기자 설정</legend>
 <label>모델<select value={value.model} onChange={e=>onChange({...value,model:e.target.value as AiSettings['model']})}>{Object.entries(AI_MODELS).map(([id,m])=><option key={id} value={id}>{m.label}</option>)}</select></label>
 <p className="muted">100만 토큰당 입력 ${rate.input} / 출력 ${rate.output} · 실제 요금은 사용량에 따라 달라집니다. GPT-5.4 mini는 추론을 끈 응답 설정을 사용합니다. 계정별 사용 가능 여부와 속도는 교사 시험에서 확인하세요.</p>
 <label>기자 말투<select value={value.tone} onChange={e=>onChange({...value,tone:e.target.value as AiSettings['tone']})}>{['친절한 기자','차분한 기자','호기심 많은 기자'].map(t=><option key={t}>{t}</option>)}</select></label>
 <label>인터뷰 시스템 프롬프트 · 직접 수정<textarea maxLength={6000} rows={12} value={value.interviewSystemPrompt} onChange={e=>onChange({...value,interviewSystemPrompt:e.target.value})} required/></label>
 <button type="button" className="quiet" onClick={()=>{if(confirm('인터뷰 시스템 프롬프트를 기본값으로 복원할까요?'))onChange({...value,interviewSystemPrompt:DEFAULT_INTERVIEW_PROMPT});}}>인터뷰 프롬프트 기본값 복원</button>
 <label>기사 시스템 프롬프트 · 직접 수정<textarea maxLength={6000} rows={12} value={value.articleSystemPrompt} onChange={e=>onChange({...value,articleSystemPrompt:e.target.value})} required/></label>
 <button type="button" className="quiet" onClick={()=>{if(confirm('기사 시스템 프롬프트를 기본값으로 복원할까요?'))onChange({...value,articleSystemPrompt:DEFAULT_ARTICLE_PROMPT});}}>기사 프롬프트 기본값 복원</button>
 <p>역할·질문 방식·기사 구성과 분량을 본문에서 직접 바꿀 수 있습니다. 각 6,000자까지 입력할 수 있습니다.</p>
 {(value.interviewInstructions || value.articleInstructions) && <details><summary>이전에 저장한 추가 지침</summary><p>기존 지침도 함께 적용됩니다. 위 본문으로 옮긴 뒤 이 칸을 비울 수 있습니다.</p><label>인터뷰 추가 지침<textarea maxLength={1000} value={value.interviewInstructions} onChange={e=>onChange({...value,interviewInstructions:e.target.value})}/></label><label>기사 추가 지침<textarea maxLength={1000} value={value.articleInstructions} onChange={e=>onChange({...value,articleInstructions:e.target.value})}/></label></details>}
 <details><summary>서버 필수 규칙과 출력 제한</summary><p>{AI_SAFETY_RULES}</p><p>질문은 한 번에 하나, 기사는 제목·부제·본문·인용 형식을 사용합니다. 질문 400자, 기사 본문 8,000자 및 서버 출력 토큰 한도가 적용됩니다.</p></details>
 </fieldset>;
}
export function ClassAiSettings({classRecord,busy,onSave}:{classRecord:ClassRecord;busy:boolean;onSave:(ai:AiSettings)=>Promise<void>}) {
 const [value,setValue]=useState(()=>aiSettingsSchema.parse(classRecord.ai||{}));
 const [saved,setSaved]=useState(false);
 return <details><summary>이 학급의 모델·시스템 프롬프트 설정</summary><p>저장 후 새로 참여하는 학생부터 적용됩니다. 진행 중인 학생은 시작 당시 설정을 유지합니다.</p><AiSettingsFields value={value} onChange={v=>{setValue(v);setSaved(false);}} disabled={busy}/><button className="secondary" disabled={busy || !value.interviewSystemPrompt.trim() || !value.articleSystemPrompt.trim()} onClick={async()=>{setSaved(false);try{await onSave(value);setSaved(true);}catch{}}}>시스템 프롬프트·AI 설정 저장</button>{saved && <p role="status">저장했습니다. 새로 참여하는 학생부터 적용됩니다.</p>}</details>;
}
