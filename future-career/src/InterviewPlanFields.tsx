import type {InterviewPlan} from '../shared/interview-plan';
export const newInterviewPlan=():InterviewPlan=>({version:2,topic:'',mode:'inquiry',mainCount:6,followupLimit:2,questions:[],articleFocus:''});
export function InterviewPlanFields({value,onChange}:{value:InterviewPlan;onChange:(v:InterviewPlan)=>void}){
 return <fieldset><legend>인터뷰 수업 설계</legend>
 <label>수업 주제<input required maxLength={200} value={value.topic} placeholder="예: 책 속 인물의 선택과 나의 생각" onChange={e=>onChange({...value,topic:e.target.value})}/></label>
 <label>인터뷰 방식<select value={value.mode} onChange={e=>onChange({...value,mode:e.target.value as InterviewPlan['mode']})}><option value="inquiry">주제 탐구 · 생각 나누기</option><option value="experience">나의 실제 경험</option><option value="roleplay">인물·직업 역할극</option></select></label>
 <label>주요 질문 수<input type="number" min={3} max={10} value={value.mainCount} onChange={e=>onChange({...value,mainCount:Number(e.target.value)})}/></label>
 <p className="muted">도입·마무리는 주요 질문 수에 포함하지 않습니다. 짧은 답변도 핵심에 답했다면 다음 질문으로 넘어갑니다.</p>
 <details><summary>핵심 질문 직접 지정 · 보충 질문 설정</summary>
 <label>핵심 질문 목록<textarea rows={5} maxLength={3100} defaultValue={value.questions.join('\n')} placeholder="비워 두면 AI가 주제와 학습 목표에 맞춰 질문합니다. 직접 지정할 때는 한 줄에 하나씩, 주요 질문 수만큼 입력하세요." onChange={e=>onChange({...value,questions:e.target.value.split('\n').map(v=>v.trim()).filter(Boolean)})}/></label>
 {value.questions.length>0&&value.questions.length!==value.mainCount&&<p role="status">핵심 질문 {value.questions.length}개를 입력했습니다. 주요 질문 수 {value.mainCount}개와 맞춰 주세요.</p>}<label>주요 질문별 보충 질문 한도<select value={value.followupLimit} onChange={e=>onChange({...value,followupLimit:Number(e.target.value)})}><option value={0}>없음</option><option value={1}>최대 1회</option><option value={2}>최대 2회 · 권장</option></select></label>
 <p className="muted">말하기를 원하지 않으면 건너뜁니다. 보충 한도에 도달해도 답변을 강요하지 않습니다. 한 활동은 추가 인터뷰를 포함해 최대 48개 답변입니다.</p></details>
 <label>기사 작성 방향<textarea maxLength={500} value={value.articleFocus} placeholder="예: 인물의 선택 이유와 학생의 생각이 드러나는 기사" onChange={e=>onChange({...value,articleFocus:e.target.value})}/></label>
 </fieldset>;
}
