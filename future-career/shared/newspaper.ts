import { z } from 'zod';
export const newspaperSchema=z.object({
 title:z.string().trim().min(1).max(60).default('남산 뉴스'),
 label:z.string().trim().min(1).max(40).default('AI 인터뷰'),
 footer:z.string().trim().min(1).max(150).default('인터뷰로 만난 생각, 나의 언어로 쓴 이야기'),
}).strict();
export type NewspaperLayout=z.infer<typeof newspaperSchema>;
export const defaultNewspaper=()=>newspaperSchema.parse({});
export function activityTime(session:{createdAt?:number;updatedAt:number;messages:{createdAt:number}[]}) {
 const value=session.createdAt ?? session.messages[0]?.createdAt;
 return value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(value):'작성 시각 기록 없음';
}
