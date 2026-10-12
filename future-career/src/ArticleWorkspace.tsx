import React, { useEffect, useRef, useState } from 'react';
import type { Session } from '../shared/domain';
import type { Article, ArticleText } from '../shared/article';
import { call, errorText, storageAvailable } from './service';

export function ArticleWorkspace({ session, teacher, onBack }: { session: Session; teacher: boolean; onBack: () => void }) {
  const [article, setArticle] = useState<Article | null>(null);
  const current = useRef<Article | null>(null);
  const [form, setForm] = useState<ArticleText>({ title: '', subtitle: '', body: '' });
  const [mode, setMode] = useState<'edit' | 'preview' | 'compare'>(teacher ? 'compare' : 'edit');
  const [state, setState] = useState('초안을 불러오는 중…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState(false);
  const saving = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submitted = Boolean(article?.submitted);
  const key = `career-article-${session.id}`;
  useEffect(() => {
    let alive = true;
    call<{ article: Article | null }>(teacher ? 'getArticle' : 'generateArticle', { sessionId: session.id }).then(({ article: a }) => {
      if (!alive) return;
      current.current = a; setArticle(a);
      if (!a) { setState('아직 생성한 기사가 없습니다.'); return; }
      let content = a.submitted || a.edited;
      try { const local = localStorage.getItem(key); if (!teacher && !a.submitted && local) content = JSON.parse(local); } catch { /* use committed copy */ }
      setForm(content); setState(a.submitted ? '최종 제출 완료' : '이 브라우저에 저장됨');
    }).catch(e => { if (alive) setError(errorText(e)); });
    return () => { alive = false; clearTimeout(timer.current); };
  }, [session.id, teacher, key]);
  async function save(content: ArticleText) {
    if (saving.current) await saving.current;
    const a = current.current;
    if (!a || a.submitted || teacher || JSON.stringify(content) === JSON.stringify(a.edited)) return;
    setState('저장 중…');
    const job = call<{ article: Article }>('saveArticle', { sessionId: session.id, content, expectedRevision: a.revision }).then(({ article: next }) => {
      current.current = next; setArticle(next); setState(storageAvailable ? '이 브라우저에 자동 저장됨' : '저장 공간 부족 · 새로고침하지 마세요'); setError('');
    });
    saving.current = job;
    try { await job; } finally { saving.current = null; }
  }
  useEffect(() => {
    if (!article || teacher || submitted) return;
    clearTimeout(timer.current);
    if (!form.title.trim() || !form.body.trim()) { setState('제목과 본문을 입력하면 자동 저장돼요.'); return; }
    timer.current = setTimeout(() => { save(form).catch(e => { setError(errorText(e)); setState('저장 실패 · 다시 저장해 주세요'); }); }, 650);
    return () => clearTimeout(timer.current);
  }, [form, teacher, submitted, Boolean(article)]);
  function change(field: keyof ArticleText, value: string) {
    const next = { ...form, [field]: value }; setForm(next); setState('저장 대기 중…');
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { setError('브라우저 저장 공간이 부족해요. 글을 복사해 보관해 주세요.'); }
  }
  async function submit() {
    if (!check || busy) return;
    if (!confirm('이 기사를 최종 제출할까요? 제출 후에는 수정할 수 없어요.')) return;
    clearTimeout(timer.current); setBusy(true);
    try {
      await save(form);
      const { article: next } = await call<{ article: Article }>('submitArticle', { sessionId: session.id, content: form, expectedRevision: current.current!.revision });
      current.current = next; setArticle(next); setMode('preview'); setState('최종 제출 완료'); try { localStorage.removeItem(key); } catch { /* submission already committed */ }
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function back() { clearTimeout(timer.current); try { if (!teacher && !submitted) await save(form); onBack(); } catch(e) { setError(errorText(e)); } }
  const paper = (content: ArticleText, label?: string) => <article className="article-paper"><div className="paper-top">THE FUTURE TIMES <span>{session.settings.futureYear}</span></div><div className="paper-meta"><span>미래 직업 탐구 · 가상 기사</span><span>{label || `${session.student.name} 기자`}</span></div><h1>{content.title}</h1>{content.subtitle && <p className="article-subtitle">{content.subtitle}</p>}<div className="article-body">{content.body}</div><div className="paper-bottom">상상으로 만난 미래, 나의 언어로 쓴 이야기</div></article>;
  return <section className="article-workspace"><div className="workspace-heading"><div><p className="eyebrow">03 · 나만의 기사 완성하기</p><h1>{submitted ? '나의 첫 미래 신문' : teacher ? '원본과 수정본 살펴보기' : '당신의 이야기, 당신의 문장으로'}</h1></div><button className="secondary" onClick={back}>← {teacher ? '교사 작업실' : '인터뷰 보기'}</button></div>
    <p className="muted">연습용 초안은 인터뷰 답변을 문장 틀에 넣어 만들었습니다. 실제 AI가 생성한 기사가 아닙니다.</p>
    {error && <div className="error" role="alert">{error}</div>}
    {article ? <><div className="workspace-toolbar"><div className="segmented">{!teacher && !submitted && <button className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>기사 편집</button>}<button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>신문 미리보기</button><button className={mode === 'compare' ? 'active' : ''} onClick={() => setMode('compare')}>초안과 비교</button></div><span className="saved" role="status">{state}</span></div>
    {submitted && <div className="submission-banner"><span className="success-mark">✓</span><div><strong>최종 제출을 마쳤어요.</strong><p>{new Date(article.submittedAt!).toLocaleString('ko-KR')} · 같은 브라우저의 교사 화면에서 확인할 수 있어요.</p></div></div>}
    {mode === 'edit' && <div className="editor-layout"><div className="editor-panel"><label>기사 제목<input value={form.title} maxLength={120} onChange={e => change('title', e.target.value)} disabled={busy}/></label><label>부제<input value={form.subtitle} maxLength={200} onChange={e => change('subtitle', e.target.value)} disabled={busy}/></label><label>기사 본문<textarea className="article-editor" value={form.body} maxLength={12000} onChange={e => change('body', e.target.value)} disabled={busy}/></label><div className="editor-bottom"><span className="muted">본문 {form.body.length.toLocaleString()} / 12,000자</span><button className="secondary" onClick={() => save(form).catch(e => setError(errorText(e)))}>지금 저장</button></div></div><aside className="writing-guide"><p className="eyebrow">편집자의 메모</p><h2>초안에서<br/>나의 글로.</h2><p>제목만 읽어도 어떤 이야기인지 알 수 있나요?</p><p>내가 말한 내용과 다른 부분은 없나요?</p><p>반복되는 표현을 고치고, 문단을 자연스럽게 연결해 보세요.</p><details><summary>인터뷰 원문 참고하기</summary>{session.messages.filter(m => m.role === 'student').map((m,i) => <p key={m.id}><b>답변 {i+1}</b><br/>{m.text}</p>)}</details></aside></div>}
    {mode === 'preview' && <div className="paper-preview">{paper(article.submitted || form)}<button className="secondary print-button" onClick={() => window.print()}>신문 인쇄 / PDF 저장</button></div>}
    {mode === 'compare' && <div className="compare-grid"><div><h3>연습용 초안 · 원본 보존</h3>{paper(article.original, '연습용 문장 틀')}</div><div><h3>{submitted ? '학생 최종 제출본' : '학생 수정본'}</h3>{paper(article.submitted || form, '학생 편집')}</div></div>}
    {!teacher && !submitted && <div className="submit-panel"><div><h3>내 이름으로 발행할 준비가 됐나요?</h3><label className="check"><input type="checkbox" checked={check} onChange={e => setCheck(e.target.checked)}/>내용을 확인했고, 개인정보가 없는지 살펴봤어요.</label></div><button disabled={!check || busy || !form.title.trim() || !form.body.trim()} onClick={submit}>{busy ? '제출 중…' : '최종 기사 제출하기 ↗'}</button></div>}
    </> : <div className="empty">{error ? '초안을 불러오지 못했어요.' : state}</div>}
  </section>;
}
