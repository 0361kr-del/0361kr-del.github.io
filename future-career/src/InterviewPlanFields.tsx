import type {InterviewPlan} from '../shared/interview-plan';
export const newInterviewPlan=():InterviewPlan=>({version:2,topic:'',mode:'auto',mainCount:6,followupLimit:2,questions:[],articleFocus:''});
export function InterviewPlanFields({value,onChange}:{value:InterviewPlan;onChange:(v:InterviewPlan)=>void}){
 return <fieldset><legend>인터뷰 수업 설계</legend>
 <label>어떤 수업인가요?<textarea required rows={8} maxLength={2000} value={value.topic} placeholder="예: 환경 문제를 배우고 해결 방법을 생각하는 수업입니다. 환경을 지키는 사람의 역할을 맡아 어떤 일을 하고 왜 필요한지 인터뷰합니다." onChange={e=>onChange({...value,topic:e.target.value,mode:'auto'})}/></label>
 <p className="muted">학생 입장 화면에도 그대로 표시됩니다. 수업 상황, 알아볼 내용, 맡을 역할을 학생에게 설명하듯 적어 주세요. {value.topic.length}/2,000</p>
 <label>학생에게 물어볼 질문<input name="entryQuestion" maxLength={200} placeholder="예: 당신의 직업은 무엇입니까?"/></label><p className="muted">학생이 입장할 때 역할·주제를 입력하는 칸 위에 표시됩니다. 비워 두면 기본 질문을 사용합니다.</p>
 <label>주요 질문 수<input type="number" min={3} max={10} value={value.mainCount} onChange={e=>onChange({...value,mainCount:Number(e.target.value)})}/></label>
 <p className="muted">도입·마무리는 주요 질문 수에 포함하지 않습니다. 짧은 답변도 핵심에 답했다면 다음 질문으로 넘어갑니다.</p>
 <details><summary>세부 설정 · 질문과 기사 방향</summary>
 <label>핵심 질문 목록<textarea rows={5} maxLength={3100} defaultValue={value.questions.join('\n')} placeholder="비워 두면 AI가 수업 설명에 맞춰 질문합니다. 직접 지정할 때는 한 줄에 하나씩, 주요 질문 수만큼 입력하세요." onChange={e=>onChange({...value,questions:e.target.value.split('\n').map(v=>v.trim()).filter(Boolean)})}/></label>
 {value.questions.length>0&&value.questions.length!==value.mainCount&&<p role="status">핵심 질문 {value.questions.length}개를 입력했습니다. 주요 질문 수 {value.mainCount}개와 맞춰 주세요.</p>}<label>주요 질문별 보충 질문 한도<select value={value.followupLimit} onChange={e=>onChange({...value,followupLimit:Number(e.target.value)})}><option value={0}>없음</option><option value={1}>최대 1회</option><option value={2}>최대 2회 · 권장</option></select></label>
 <p className="muted">말하기를 원하지 않으면 건너뜁니다. 보충 한도에 도달해도 답변을 강요하지 않습니다. 한 활동은 추가 인터뷰를 포함해 최대 48개 답변입니다.</p>
 <label>기사 작성 방향<textarea maxLength={500} value={value.articleFocus} placeholder="예: 인물의 선택 이유와 학생의 생각이 드러나는 기사" onChange={e=>onChange({...value,articleFocus:e.target.value})}/></label>
 </details></fieldset>;
}
