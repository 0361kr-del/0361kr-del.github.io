import { interviewPlanSchema, startGuided, type GuidedProgress } from './interview-plan.js';
import { newspaperSchema } from './newspaper.js';
import { z } from 'zod';
import { aiSettingsSchema } from './ai-settings.js';

const text = (max: number) => z.string().transform(v => v.normalize('NFC').trim()).pipe(z.string().min(1).refine(v => [...v].length <= max));
export const classInput = z.object({ title: text(80), classroom: text(20), grade: z.number().int().min(1).max(12).default(6), maxStudents: z.number().int().min(1).max(40).default(23), questionLimit: z.number().int().min(3).max(12).default(8), futureYear: z.number().int().min(2026).max(2100).optional(), objective: text(2000), interviewPlan:interviewPlanSchema.optional(), newspaper:newspaperSchema.optional(), ai: aiSettingsSchema.optional() }).strict();
export const studentInput = z.object({ name: text(40), grade: z.number().int().min(1).max(12), classroom: text(20), number: z.number().int().min(1).max(100), career: text(80), noticeAccepted: z.literal(true) }).strict();
export const answerInput = z.object({ text: text(1000), questionId: z.string().regex(/^q-\d+$/), expectedRevision: z.number().int().nonnegative() }).strict();
export const requestIdSchema = z.uuid();
export type ClassInput = z.infer<typeof classInput>;
export type StudentInput = z.infer<typeof studentInput>;
export type ClassRecord = ClassInput & { id: string; teacherUid: string; status: 'OPEN' | 'CLOSED'; studentCount: number; deleting?: boolean; createdAt: number; retainUntil: number };
export type Message = { id: string; seq: number; role: 'reporter' | 'student'; text: string; createdAt: number };
export type Session = { guided?:GuidedProgress; id: string; classId: string; teacherUid: string; ownerUid: string; career: string; student: StudentInput; settings: ClassInput; status: 'INTERVIEWING' | 'INTERVIEW_COMPLETED'; answerCount: number; revision: number; currentQuestionId: string; ownershipEpoch: number; retainUntil: number; createdAt?: number; updatedAt: number; messages: Message[] };
export class DomainError extends Error { constructor(public code: string) { super(code); } }
export function assertOwner(session: Pick<Session, 'ownerUid' | 'retainUntil'>, uid: string, now: number) { if (session.ownerUid !== uid || session.retainUntil <= now) throw new DomainError('ACCESS_DENIED'); }

// Emulator-only interview fixtures. These are deliberately NOT an AI substitute.
export function fixtureQuestion(index: number, career: string, previous = ''): string {
  const questions = [`“${career}”에 대해 먼저 소개해 주세요.`, '이 주제에 관심을 갖게 된 계기는 무엇인가요?', '어려운 일을 만났을 때 어떻게 해결했나요?', '가장 기억에 남는 장면이나 경험은 무엇인가요?', '이 주제가 우리에게 어떤 의미가 있다고 생각하나요?', '그렇게 생각하는 이유를 예를 들어 설명해 주세요.', '앞으로 이루고 싶은 목표는 무엇인가요?', '다른 사람에게 꼭 전하고 싶은 이야기는 무엇인가요?', '이 주제에서 중요하게 생각하는 가치는 무엇인가요?', '더 알아보고 싶은 점은 무엇인가요?', '다른 관점에서 보면 어떤 생각이 드나요?', '오늘 이야기를 한 문장으로 정리하면 무엇인가요?'];
  const context = previous ? `“${[...previous].slice(0, 35).join('')}${[...previous].length > 35 ? '…' : ''}”라고 이야기했군요. ` : '';
  return context + questions[(index - 1) % questions.length];
}
export function startSession(id: string, classRecord: ClassRecord, student: StudentInput, uid: string, now: number): Session {
  return { ...(classRecord.interviewPlan?{guided:startGuided(classRecord.interviewPlan)}:{}), id, classId: classRecord.id, teacherUid: classRecord.teacherUid, ownerUid: uid, career: student.career, student, settings: classInput.parse(classRecordToInput(classRecord)), status: 'INTERVIEWING', answerCount: 0, revision: 0, currentQuestionId: 'q-1', ownershipEpoch: 0, retainUntil: classRecord.retainUntil, createdAt: now, updatedAt: now, messages: [{ id: 'q-1', seq: 1, role: 'reporter', text: fixtureQuestion(1, student.career), createdAt: now }] };
}
export function classRecordToInput(c: ClassRecord): ClassInput { return { title: c.title, classroom: c.classroom, grade: c.grade, maxStudents: c.maxStudents, questionLimit: c.questionLimit, objective: c.objective, ...(c.interviewPlan?{interviewPlan:c.interviewPlan}:{}), ...(c.ai ? { ai:c.ai } : {}) }; }
export function appendAnswer(s: Session, raw: unknown, uid: string, now: number): Session {
  assertOwner(s, uid, now);
  const a = answerInput.parse(raw);
  if (s.status !== 'INTERVIEWING') throw new DomainError('WRONG_STATE');
  if (s.revision !== a.expectedRevision || s.currentQuestionId !== a.questionId) throw new DomainError('REVISION_CONFLICT');
  const answerCount = s.answerCount + 1;
  const completed = answerCount >= s.settings.questionLimit;
  const messages = [...s.messages, { id: `a-${answerCount}`, seq: s.messages.length + 1, role: 'student' as const, text: a.text, createdAt: now }];
  if (!completed) messages.push({ id: `q-${answerCount + 1}`, seq: messages.length + 1, role: 'reporter', text: fixtureQuestion(answerCount + 1, s.career, a.text), createdAt: now });
  return { ...s, answerCount, messages, revision: s.revision + 1, currentQuestionId: completed ? '' : `q-${answerCount + 1}`, status: completed ? 'INTERVIEW_COMPLETED' : 'INTERVIEWING', updatedAt: now };
}
export function finishSession(s: Session, uid: string, revision: number, now: number): Session {
  assertOwner(s, uid, now);
  if (s.status !== 'INTERVIEWING') throw new DomainError('WRONG_STATE');
  if (s.revision !== revision) throw new DomainError('REVISION_CONFLICT');
  if (s.answerCount < 3) throw new DomainError('MINIMUM_ANSWERS');
  return { ...s, status: 'INTERVIEW_COMPLETED', currentQuestionId: '', revision: s.revision + 1, updatedAt: now };
}
