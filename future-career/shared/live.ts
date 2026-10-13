import { appendAnswer, assertOwner, DomainError, type Session } from './domain.js';
export type LiveSession = Session & { answerLimit?: number; continuationCount?: number; awaitingQuestion?: boolean; articleState?: 'editing' | 'submitted'; aiLease?: { token: string; expiresAt: number } | null };
export function saveLiveAnswer(s: LiveSession, raw: unknown, uid: string, now: number): LiveSession {
  if (s.awaitingQuestion || (s.aiLease && s.aiLease.expiresAt > now)) throw new DomainError('AI_REQUEST_PENDING');
  const next = { ...appendAnswer({...s,settings:{...s.settings,questionLimit:s.answerLimit||s.settings.questionLimit}}, raw, uid, now), settings:s.settings };
  // Save the student's answer first. No placeholder is presented as an AI response.
  if (next.status === 'INTERVIEW_COMPLETED') return { ...next, awaitingQuestion: false };
  return { ...next, messages: next.messages.slice(0, -1), currentQuestionId: '', awaitingQuestion: true };
}
export function attachQuestion(s: LiveSession, uid: string, revision: number, question: string, now: number): LiveSession {
  assertOwner(s, uid, now);
  if (s.revision !== revision || !s.awaitingQuestion || s.status !== 'INTERVIEWING') throw new DomainError('REVISION_CONFLICT');
  const id = `q-${s.answerCount + 1}`;
  return { ...s, awaitingQuestion: false, aiLease: null, currentQuestionId: id, revision: s.revision + 1, updatedAt: now, messages: [...s.messages, { id, seq: s.messages.length + 1, role: 'reporter', text: question, createdAt: now }] };
}

export const MAX_INTERVIEW_ANSWERS = 24;
export function reopenInterview(s: LiveSession, uid: string, revision: number, now: number): LiveSession {
  assertOwner(s,uid,now);
  if(s.revision!==revision)throw new DomainError('REVISION_CONFLICT');
  if(s.status!=='INTERVIEW_COMPLETED')throw new DomainError('WRONG_STATE');
  if(s.aiLease && s.aiLease.expiresAt>now)throw new DomainError('AI_REQUEST_PENDING');
  if(s.answerCount>=MAX_INTERVIEW_ANSWERS)throw new DomainError('INTERVIEW_TOTAL_LIMIT');
  const last=s.messages.at(-1),pending=last?.role==='reporter' && last.id===`q-${s.answerCount+1}`;
  return {...s,status:'INTERVIEWING',answerLimit:Math.min(MAX_INTERVIEW_ANSWERS,Math.max(s.answerLimit||s.settings.questionLimit,s.answerCount+3)),continuationCount:(s.continuationCount||0)+1,awaitingQuestion:!pending,currentQuestionId:pending?last.id:'',revision:s.revision+1,updatedAt:now};
}
