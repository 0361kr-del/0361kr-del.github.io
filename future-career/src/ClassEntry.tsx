import React, { useMemo, useState } from 'react';
import qrcode from './vendor/qrcode.js';
import { demo } from './service';
export function entryUrl(code: string) { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('class', code); return u.toString(); }
export function qrImage(value: string) {
  const qr = qrcode(0, 'M'); qr.addData(value); qr.make(); const n=qr.getModuleCount(); let d='';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(qr.isDark(r,c)) d+=`M${c+4} ${r+4}h1v1h-1z`;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n+8} ${n+8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${d}" fill="black"/></svg>`)}`;
}
export function ClassEntry({ code, title, open, onTry }: { code: string; title: string; open: boolean; onTry: () => void }) {
  const url=entryUrl(code), src=useMemo(()=>qrImage(url),[url]); const [copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
  return <div className="class-entry"><div><img src={src} alt={`${title} 입장 QR 코드`} width={184} height={184}/><a className="qr-download" href={src} download="class-entry-qr.svg">QR 이미지 저장</a></div><div><p className="eyebrow">우리 반 공용 입장 QR</p><h3>{title}</h3><p>QR을 찍고 별명·번호·인터뷰 주제을 입력하면 시작해요.<br/>학생은 수업 코드나 개인 참여권을 입력하지 않아요.</p><label className="entry-link-label">학급 입장 링크<input readOnly value={url} onFocus={e=>e.currentTarget.select()}/></label><div className="entry-actions"><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);setCopyError(false);}catch{setCopyError(true);}}}>{copied?'링크 복사됨':'입장 링크 복사'}</button><button disabled={!open} onClick={onTry}>학생 입장 체험 →</button></div>{!open&&<p className="entry-warning">입장이 마감된 학급입니다.</p>}{copyError&&<p role="alert">위 링크를 선택해서 직접 복사해 주세요.</p>}{demo&&<p className="entry-warning">프리뷰용 QR입니다. 현재 사이트는 교사 본인만 접속 가능하며, 다른 기기의 자료는 모이지 않습니다. 실제 학급 사용은 Firebase 연결 후 가능합니다.</p>}</div></div>;
}
