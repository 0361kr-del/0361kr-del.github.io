import { useState } from 'react';
import { newspaperSchema, type NewspaperLayout } from '../shared/newspaper';
import type { ClassRecord } from '../shared/domain';
export function NewspaperSettings({classRecord,busy,onSave}:{classRecord:ClassRecord;busy:boolean;onSave:(layout:NewspaperLayout)=>Promise<void>}) {
 const [value,setValue]=useState(()=>newspaperSchema.parse(classRecord.newspaper||{}));
 const [saved,setSaved]=useState(false);
 return <details><summary>신문 레이아웃 문구 설정</summary><p>이 학급의 기사 미리보기와 인쇄에 적용됩니다. 기존 기사 본문은 바뀌지 않습니다. 작성 시각은 활동 시작 시각으로 자동 표시합니다.</p><fieldset disabled={busy}>
 <label>신문 제목<input maxLength={60} value={value.title} onChange={e=>{setValue({...value,title:e.target.value});setSaved(false);}}/></label>
 <label>오른쪽 아래 표시<input maxLength={40} value={value.label} onChange={e=>{setValue({...value,label:e.target.value});setSaved(false);}}/></label>
 <label>중앙 하단 문구<input maxLength={150} value={value.footer} onChange={e=>{setValue({...value,footer:e.target.value});setSaved(false);}}/></label>
 <button disabled={busy||!newspaperSchema.safeParse(value).success} onClick={async()=>{setSaved(false);try{await onSave(value);setSaved(true);}catch{}}}>신문 문구 저장</button>{saved&&<p role="status">저장했습니다. 기사 화면을 다시 열면 적용됩니다.</p>}
 </fieldset></details>;
}
