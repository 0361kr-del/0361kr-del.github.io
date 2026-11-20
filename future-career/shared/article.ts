import { z } from 'zod';
import { DomainError, type Session } from './domain.js';
export const articleInput = z.object({ title: z.string().trim().min(1).max(120), subtitle: z.string().trim().max(200), body: z.string().trim().min(1).max(12000) }).strict();
export type ArticleText = z.infer<typeof articleInput>;
export type Article = { sessionId: string; original: ArticleText; edited: ArticleText; submitted: ArticleText | null; revision: number; updatedAt: number; submittedAt: number | null; generator: 'template-preview' | 'openai' };
// Deliberately deterministic. Preserve quoted answers verbatim; no invented facts.
export function createPreviewArticle(s: Session, now: number): Article {
  if (s.status !== 'INTERVIEW_COMPLETED') throw new DomainError('WRONG_STATE');
  const answers = s.messages.filter(m => m.role === 'student');
  const original = { title: `${s.career}, 인터뷰로 만난 이야기`, subtitle: `${s.student.name}이 들려주는 생각과 경험`, body: [`[교육용 AI 인터뷰] ${s.student.name}과 “${s.career}”에 대해 나눈 이야기입니다. 역할극이나 상상으로 답한 내용은 실제 사실과 다를 수 있습니다.`, ...answers.map((m, i) => `${i === 0 ? '주제를 소개하며' : '이어서'} ${s.student.name}은 이렇게 말했습니다.\n“${m.text}”`)].join('\n\n') };
  return { sessionId: s.id, original, edited: { ...original }, submitted: null, revision: 0, updatedAt: now, submittedAt: null, generator: 'template-preview' };
}
export function reviseArticle(a: Article, raw: unknown, revision: number, now: number): Article {
  if (a.submitted) throw new DomainError('ARTICLE_SUBMITTED');
  if (a.revision !== revision) throw new DomainError('REVISION_CONFLICT');
  return { ...a, edited: articleInput.parse(raw), revision: a.revision + 1, updatedAt: now };
}
export function submitArticle(a: Article, raw: unknown, revision: number, now: number): Article {
  const saved = reviseArticle(a, raw, revision, now);
  return { ...saved, submitted: { ...saved.edited }, submittedAt: now };
}
