import { useState } from 'react';
import { AI_MODELS, AI_BASE_PROMPT, defaultAiSettings, type AiSettings } from '../shared/ai-settings';
import type { ClassRecord } from '../shared/domain';
export function AiSettingsFields({value,onChange,disabled=false}:{value:AiSettings;onChange:(v:AiSettings)=>void;disabled?:boolean}) {
 const rate=AI_MODELS[value.model];
 return <fieldset disabled={disabled}><legend>AI 기자 설정</legend>
 <label>모델<select value={value.model} onChange={e=>onChange({...value,model:e.target.value as AiSettings['model']})}>{Object.entries(AI_MODELS).map(([id,m])=><option key={id} value={id}>{m.label}</option>)}</select></label>
 <p className="muted">100만 토큰당 입력 ${rate.input} / 출력 ${rate.output} · 실제 요금은 사용량에 따라 달라집니다. GPT-5.4 mini는 추론을 끈 응답 설정을 사용합니다. 계정별 사용 가능 여부와 속도는 교사 시험에서 확인하세요.</p>
 <label>기자 말투<select value={value.tone} onChange={e=>onChange({...value,tone:e.target.value as AiSettings['tone']})}>{['친절한 기자','차분한 기자','호기심 많은 기자'].map(t=><option key={t}>{t}</option>)}</select></label>
 <label>인터뷰 추가 지침<textarea maxLength={1000} rows={3} value={value.interviewInstructions} onChange={e=>onChange({...value,interviewInstructions:e.target.value})} placeholder="예: 환경 보호와 관련된 경험을 한 번 물어봐 주세요."/></label>
 <label>기사 작성 추가 지침<textarea maxLength={1000} rows={3} value={value.articleInstructions} onChange={e=>onChange({...value,articleInstructions:e.target.value})} placeholder="예: 사회에 기여하는 내용을 마지막 문단에 정리해 주세요."/></label>
 <details><summary>공통 시스템 프롬프트 보기</summary><p style={{whiteSpace:'pre-wrap'}}>{AI_BASE_PROMPT}</p><p>인터뷰는 한 번에 한 질문, 기사는 인터뷰에 근거한 3~5문단으로 작성합니다. 개인정보·안전·사실성·출력 형식 규칙은 서버에서 유지합니다. 프롬프트만으로 모든 잘못된 응답을 막을 수 없으므로 교사 검토가 필요합니다.</p></details>
 </fieldset>;
}
export function ClassAiSettings({classRecord,busy,onSave}:{classRecord:ClassRecord;busy:boolean;onSave:(ai:AiSettings)=>void}) {
 const [value,setValue]=useState(classRecord.ai||defaultAiSettings());
 return <details><summary>이 학급의 모델·시스템 프롬프트 설정</summary><p>저장 후 새로 참여하는 학생부터 적용됩니다. 진행 중인 학생은 시작 당시 설정을 유지합니다.</p><AiSettingsFields value={value} onChange={setValue} disabled={busy}/><button className="secondary" disabled={busy} onClick={()=>onSave(value)}>AI 설정 저장</button></details>;
}
