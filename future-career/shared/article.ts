import { z } from 'zod';
import { DomainError, type Session } from './domain.js';
export const articleInput = z.object({ title: z.string().trim().min(1).max(120), subtitle: z.string().trim().max(200), body: z.string().trim().min(1).max(12000) }).strict();
export type ArticleText = z.infer<typeof articleInput>;
export type Article = { sessionId: string; original: ArticleText; edited: ArticleText; submitted: ArticleText | null; revision: number; updatedAt: number; submittedAt: number | null; generator: 'template-preview' | 'openai' };
// Deliberately deterministic. Preserve quoted answers verbatim; no invented facts.
export function createPreviewArticle(s: Session, now: number): Article {
  if (s.status !== 'INTERVIEW_COMPLETED') throw new DomainError('WRONG_STATE');
  const answers = s.messages.filter(m => m.role === 'student');
  const original = { title: `${s.settings.futureYear}년, ${s.career}의 하루를 만나다`, subtitle: `${s.student.name}이 들려주는 미래의 일과 꿈`, body: [`이 기사는 미래 직업을 상상한 가상 인터뷰입니다. ${s.settings.futureYear}년 ${s.career}(으)로 일하는 ${s.student.name}을 만났습니다.`, ...answers.map((m, i) => `${i === 0 ? '자신의 일을 소개하며' : '이어서'} ${s.student.name}은 이렇게 말했습니다.\n“${m.text}”`)].join('\n\n') };
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
